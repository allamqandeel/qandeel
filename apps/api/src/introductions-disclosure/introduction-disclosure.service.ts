import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError, readDataApiUpstreamIdentity } from '../conversation/supabase-data-api.service';
import {
  DisclosureRow, DisplayNamesRow, IntroductionDisclosureRepository, OutcomeRow, OwnRenditionRow, ShareRow,
} from './introduction-disclosure.repository';
import { prepareIntroductionImage } from './introduction-image.pipeline';
import type { IntroductionMediaObjectStore } from './introduction-media.store';

export const INTRODUCTION_MEDIA_STORE = Symbol('INTRODUCTION_MEDIA_STORE');

/** The bounded vocabulary (D-10, D-11): three text types, four personal keys, and no other. */
export const TEXT_RESOURCE_TYPES = ['FULL_NAME', 'CONTACT_METHOD', 'DEEPER_PERSONAL_FIELD'] as const;
export const PERSONAL_FIELD_KEYS = ['work_field', 'education', 'hometown_city', 'about_me'] as const;
export const TEXT_MAX_LENGTH = 512;
export const HOMETOWN_MAX_LENGTH = 64;
/** The three uploads must finish well inside the database's 120 s upload deadline (condition 1). */
const UPLOAD_BUDGET_MS = 60_000;
const MEDIA_READ_BUDGET_MS = 10_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' }); };
const objectOf = (body: unknown): Record<string, unknown> =>
  (body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {});
const onlyKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));
const keysAre = (row: unknown, keys: readonly string[]): row is Record<string, unknown> =>
  !!row && typeof row === 'object' && !Array.isArray(row)
  && Object.keys(row).length === keys.length && keys.every((key) => key in (row as Record<string, unknown>));

export interface DisclosureItem {
  readonly kind: 'TEXT' | 'IMAGE';
  readonly mine: boolean;
  readonly materialId: string;
  readonly versionId: string;
  readonly resourceType: string;
  readonly fieldKey: string | null;
  readonly text: string | null;
  readonly stage: number | null;
  readonly handle: string | null;
  readonly seriesId: string | null;
  readonly establishedAt: string;
}

export type DisclosuresView =
  | { readonly outcome: 'UNAVAILABLE' }
  | {
    readonly outcome: 'READY';
    readonly introductionState: 'ACTIVE' | 'ENDED' | 'SHARED_WORLD';
    readonly items: readonly DisclosureItem[];
    readonly myPhoto: { readonly seriesId: string; readonly state: string; readonly unsharedStages: ReadonlyArray<{ stage: number; handle: string }> } | null;
    readonly myDisplayedVersionId: string | null;
    readonly otherDisplayName: string | null;
  };

const STATES = ['ACTIVE', 'ENDED', 'SHARED_WORLD'] as const;
const DISCLOSURE_COLUMNS = ['introduction_state', 'item_kind', 'is_mine', 'disclosure_material_id', 'disclosure_version_id', 'resource_type',
  'field_key', 'text_value', 'image_series_id', 'image_stage', 'media_handle', 'series_state', 'established_at'] as const;
const NAME_COLUMNS = ['introduction_state', 'my_displayed_version_id', 'other_display_name'] as const;
const SHARE_COLUMNS = ['world_id', 'introduction_state', 'other_first_name', 'disclosure_material_id', 'disclosure_version_id', 'resource_type',
  'field_key', 'text_value', 'image_series_id', 'image_stage', 'is_displayed', 'established_at'] as const;

const RENDITION_COLUMNS = ['world_id', 'introduction_started_at', 'stage', 'media_handle', 'is_shared'] as const;

/** S6-07 (CP4): one of the caller's OWN photo renditions that still exist, for Export My Data. */
export interface OwnExportRendition {
  readonly worldId: string;
  /** The instant the package prints for that Introduction, exactly as the database wrote it. */
  readonly introductionStartedAt: string;
  readonly stage: 1 | 2 | 3;
  readonly handle: string;
  readonly shared: boolean;
}
export type OwnExportMedia = { readonly kind: 'BYTES'; readonly bytes: Buffer } | { readonly kind: 'NOT_AVAILABLE' };
/** The store has no object for a key the database still holds: an integrity defect, never a quietly thinner export. */
export class ExportMediaIntegrityError extends Error {
  constructor() {
    super('introduction media object missing for a live key');
    this.name = 'ExportMediaIntegrityError';
  }
}

const nullableString = (v: unknown): boolean => v === null || typeof v === 'string';
const nullableUuid = (v: unknown): boolean => v === null || isUuid(v);
const nullableStage = (v: unknown): boolean => v === null || (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 3);

/**
 * S6-06 — progressive disclosure, photos and the display-name consent, for the two humans of an Introduction.
 *
 * Every answer is decided by the database from the caller's own token. This service validates the request, decodes the
 * bounded rows fail-closed, and - for photos only - runs the server-side image pipeline and the object store under the
 * database's write-ahead intent. It never returns a storage key, a URL or a user id, and it logs nothing.
 */
@Injectable()
export class IntroductionDisclosureService {
  constructor(
    private readonly repository: IntroductionDisclosureRepository,
    @Inject(INTRODUCTION_MEDIA_STORE) private readonly store: IntroductionMediaObjectStore,
  ) {}

  async read(token: string, worldId: string): Promise<DisclosuresView> {
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    const world = worldId.toLowerCase();
    const [rows, names] = await Promise.all([
      this.guard(() => this.repository.readDisclosures(token, world)),
      this.guard(() => this.repository.readDisplayNames(token, world)),
    ]);
    if (!Array.isArray(rows) || !Array.isArray(names)) return unavailable();
    if (rows.length === 0 || names.length !== 1) return { outcome: 'UNAVAILABLE' };
    const name = names[0] as DisplayNamesRow;
    if (!keysAre(name, NAME_COLUMNS) || !nullableUuid(name.my_displayed_version_id) || !nullableString(name.other_display_name)) return unavailable();
    const state = rows[0].introduction_state;
    if (!STATES.includes(state as never) || name.introduction_state !== state) return unavailable();
    const items: DisclosureItem[] = [];
    let myPhoto: { seriesId: string; state: string; unsharedStages: Array<{ stage: number; handle: string }> } | null = null;
    for (const row of rows as DisclosureRow[]) {
      if (!keysAre(row, DISCLOSURE_COLUMNS) || row.introduction_state !== state || !nullableStage(row.image_stage)
          || !nullableUuid(row.image_series_id) || !nullableUuid(row.media_handle)) return unavailable();
      if (row.item_kind === 'NONE') continue;
      if (row.item_kind === 'MY_IMAGE_STAGE') {
        if (!isUuid(row.image_series_id) || !isUuid(row.media_handle) || row.image_stage === null || typeof row.series_state !== 'string') return unavailable();
        if (myPhoto === null) myPhoto = { seriesId: row.image_series_id, state: row.series_state, unsharedStages: [] };
        if (myPhoto.seriesId !== row.image_series_id) return unavailable();
        myPhoto.unsharedStages.push({ stage: row.image_stage, handle: row.media_handle });
        continue;
      }
      if ((row.item_kind !== 'TEXT' && row.item_kind !== 'IMAGE') || typeof row.is_mine !== 'boolean'
          || !isUuid(row.disclosure_material_id) || !isUuid(row.disclosure_version_id) || typeof row.resource_type !== 'string'
          || typeof row.established_at !== 'string' || !nullableString(row.field_key) || !nullableString(row.text_value)) return unavailable();
      if (row.item_kind === 'TEXT' && typeof row.text_value !== 'string') return unavailable();
      if (row.item_kind === 'IMAGE' && (row.image_stage === null || !isUuid(row.media_handle))) return unavailable();
      // The counterpart never learns the owner's series.
      if (!row.is_mine && row.image_series_id !== null) return unavailable();
      items.push({
        kind: row.item_kind, mine: row.is_mine, materialId: row.disclosure_material_id, versionId: row.disclosure_version_id,
        resourceType: row.resource_type, fieldKey: row.field_key, text: row.text_value, stage: row.image_stage,
        handle: row.media_handle, seriesId: row.image_series_id, establishedAt: row.established_at,
      });
    }
    if (myPhoto !== null) myPhoto.unsharedStages.sort((x, y) => x.stage - y.stage);
    return {
      outcome: 'READY', introductionState: state as 'ACTIVE' | 'ENDED' | 'SHARED_WORLD',
      items, myPhoto, myDisplayedVersionId: name.my_displayed_version_id, otherDisplayName: name.other_display_name,
    };
  }

  async shares(token: string): Promise<{ outcome: 'READY'; worlds: Array<{ worldId: string; introductionState: string; otherFirstName: string | null; shares: unknown[] }> }> {
    const rows = await this.guard(() => this.repository.listShares(token));
    if (!Array.isArray(rows)) return unavailable();
    const worlds = new Map<string, { worldId: string; introductionState: string; otherFirstName: string | null; shares: unknown[] }>();
    for (const row of rows as ShareRow[]) {
      if (!keysAre(row, SHARE_COLUMNS) || !isUuid(row.world_id) || !STATES.includes(row.introduction_state as never)
          || !nullableString(row.other_first_name) || !isUuid(row.disclosure_material_id) || !isUuid(row.disclosure_version_id)
          || typeof row.resource_type !== 'string' || !nullableString(row.field_key) || !nullableString(row.text_value)
          || !nullableUuid(row.image_series_id) || !nullableStage(row.image_stage) || typeof row.is_displayed !== 'boolean'
          || typeof row.established_at !== 'string') return unavailable();
      const world = worlds.get(row.world_id) ?? { worldId: row.world_id, introductionState: row.introduction_state, otherFirstName: row.other_first_name, shares: [] };
      world.shares.push({
        materialId: row.disclosure_material_id, versionId: row.disclosure_version_id, resourceType: row.resource_type,
        fieldKey: row.field_key, text: row.text_value, seriesId: row.image_series_id, stage: row.image_stage,
        displayed: row.is_displayed, establishedAt: row.established_at,
      });
      worlds.set(row.world_id, world);
    }
    return { outcome: 'READY', worlds: [...worlds.values()] };
  }

  async shareText(token: string, worldId: string, body: unknown): Promise<{ outcome: string; materialId?: string; disclosedAt?: string }> {
    const value = objectOf(body);
    const type = value.resourceType;
    const key = value.fieldKey ?? null;
    const text = value.text;
    if (!onlyKeys(value, ['commandId', 'resourceType', 'fieldKey', 'text']) || !isUuid(value.commandId)
        || typeof type !== 'string' || !TEXT_RESOURCE_TYPES.includes(type as never)
        || (type === 'DEEPER_PERSONAL_FIELD') !== (key !== null)
        || (key !== null && (typeof key !== 'string' || !PERSONAL_FIELD_KEYS.includes(key as never)))
        || typeof text !== 'string' || text.trim().length === 0 || /[\n\r]/u.test(text) || text.length > TEXT_MAX_LENGTH
        || (key === 'hometown_city' && text.length > HOMETOWN_MAX_LENGTH)) return invalid();
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    const rows = await this.guard(() => this.repository.shareText(token, (value.commandId as string).toLowerCase(), worldId.toLowerCase(),
      type, key as string | null, text));
    return this.disclosedAnswer(rows, ['DISCLOSED', 'CONTACT_REFUSED', 'NOT_AVAILABLE_NOW', 'DELETED', 'COMMAND_CONFLICT', 'UNAVAILABLE']);
  }

  async shareStage(token: string, worldId: string, body: unknown): Promise<{ outcome: string; materialId?: string; disclosedAt?: string }> {
    const value = objectOf(body);
    if (!onlyKeys(value, ['commandId', 'seriesId', 'stage']) || !isUuid(value.commandId) || !isUuid(value.seriesId)
        || !Number.isInteger(value.stage) || (value.stage as number) < 1 || (value.stage as number) > 3) return invalid();
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    const rows = await this.guard(() => this.repository.shareStage(token, (value.commandId as string).toLowerCase(), worldId.toLowerCase(),
      (value.seriesId as string).toLowerCase(), value.stage as number));
    return this.disclosedAnswer(rows, ['DISCLOSED', 'RETIRED', 'NOT_AVAILABLE_NOW', 'DELETED', 'COMMAND_CONFLICT', 'UNAVAILABLE']);
  }

  async removeImage(token: string, worldId: string, body: unknown): Promise<{ outcome: string }> {
    const value = objectOf(body);
    if (!onlyKeys(value, ['commandId', 'seriesId']) || !isUuid(value.commandId) || !isUuid(value.seriesId)) return invalid();
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    const rows = await this.guard(() => this.repository.removeImage(token, (value.commandId as string).toLowerCase(), worldId.toLowerCase(),
      (value.seriesId as string).toLowerCase()));
    return this.outcomeAnswer(rows, ['REMOVED', 'UNAVAILABLE']);
  }

  async grantDisplayName(token: string, worldId: string, body: unknown): Promise<{ outcome: string }> {
    const value = objectOf(body);
    if (!onlyKeys(value, ['commandId', 'versionId']) || !isUuid(value.commandId) || !isUuid(value.versionId)) return invalid();
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    const rows = await this.guard(() => this.repository.grantDisplayName(token, (value.commandId as string).toLowerCase(), worldId.toLowerCase(),
      (value.versionId as string).toLowerCase()));
    return this.outcomeAnswer(rows, ['GRANTED', 'NOT_SHARED', 'NOT_AVAILABLE_NOW', 'COMMAND_CONFLICT', 'UNAVAILABLE']);
  }

  async revokeDisplayName(token: string, worldId: string, body: unknown): Promise<{ outcome: string }> {
    const value = objectOf(body);
    if (!onlyKeys(value, ['commandId']) || !isUuid(value.commandId)) return invalid();
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    const rows = await this.guard(() => this.repository.revokeDisplayName(token, (value.commandId as string).toLowerCase(), worldId.toLowerCase()));
    return this.outcomeAnswer(rows, ['REVOKED', 'COMMAND_CONFLICT', 'UNAVAILABLE']);
  }

  /**
   * One photo: the database's gated write-ahead intent FIRST (production answers NOT_AVAILABLE_NOW and the bytes are never
   * even decoded), then the pipeline in memory, then the three renditions to the store under the keys the database chose,
   * then the completion. Any failure after the intent removes the series, so its keys go to the erasure queue.
   */
  async uploadImage(token: string, worldId: string, commandId: string, bytes: Buffer | null): Promise<{ outcome: string; seriesId?: string; reason?: string }> {
    if (!isUuid(commandId)) return invalid();
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    if (bytes === null) return { outcome: 'IMAGE_REFUSED', reason: 'TOO_LARGE' };
    if (!this.store.isConfigured()) return { outcome: 'UNAVAILABLE' };
    const world = worldId.toLowerCase();
    const command = commandId.toLowerCase();
    const begun = await this.guard(() => this.repository.beginImage(token, command, world));
    if (!Array.isArray(begun) || begun.length !== 1 || !keysAre(begun[0], ['outcome', 'image_series_id'])) return unavailable();
    const { outcome, image_series_id: series } = begun[0];
    if (outcome !== 'BEGUN') {
      if (!['PHOTO_ACTIVE', 'NOT_AVAILABLE_NOW', 'REMOVED', 'COMMAND_CONFLICT', 'UNAVAILABLE'].includes(outcome)) return unavailable();
      return { outcome };
    }
    if (!isUuid(series)) return unavailable();
    const keys = await this.guard(() => this.repository.uploadKeys(series));
    if (!Array.isArray(keys)) return unavailable();
    // A retry of a begin whose upload already completed: nothing to store again.
    if (keys.length === 0) {
      const done = await this.guard(() => this.repository.completeImage(series));
      return Array.isArray(done) && done[0]?.outcome === 'READY' ? { outcome: 'READY', seriesId: series } : { outcome: 'UNAVAILABLE' };
    }
    if (keys.length !== 3 || !keys.every((k, i) => keysAre(k, ['stage', 'storage_key']) && k.stage === i + 1 && typeof k.storage_key === 'string')) {
      return unavailable();
    }
    const prepared = await prepareIntroductionImage(bytes);
    if (!prepared.ok) {
      await this.discard(token, world, series);
      return { outcome: 'IMAGE_REFUSED', reason: prepared.rejection };
    }
    const signal = AbortSignal.timeout(UPLOAD_BUDGET_MS);
    try {
      const { strong, medium, clear } = prepared.renditions;
      // One object at a time: the first failure stops before the next is written, and no store sees concurrent first
      // writes under one prefix (rclone serve s3, the CI store, replaces its directory node on each - see the S6-06 record §7.2).
      const renditions = [strong, medium, clear];
      for (let i = 0; i < renditions.length; i += 1) await this.store.put(keys[i].storage_key, renditions[i], signal);
    } catch {
      await this.discard(token, world, series);
      return { outcome: 'UNAVAILABLE' };
    }
    const done = await this.guard(() => this.repository.completeImage(series));
    if (!Array.isArray(done) || done[0]?.outcome !== 'READY') {
      // The deadline passed or the photo was removed meanwhile: the objects just written are already the queue's to erase.
      await this.discard(token, world, series);
      return { outcome: 'UNAVAILABLE' };
    }
    return { outcome: 'READY', seriesId: series };
  }

  /** The bytes of one rendition, re-authorized for this reader on THIS request; never a URL. */
  async media(token: string, worldId: string, handle: string): Promise<Buffer> {
    if (!isUuid(worldId) || !isUuid(handle) || !this.store.isConfigured()) throw new NotFoundException({ outcome: 'UNAVAILABLE' });
    const answer = await this.guard(() => this.repository.authorizeMedia(token, worldId.toLowerCase(), handle.toLowerCase()));
    if (!Array.isArray(answer) || answer.length !== 1 || answer[0].outcome !== 'AUTHORIZED') throw new NotFoundException({ outcome: 'UNAVAILABLE' });
    const key = await this.guard(() => this.repository.mediaKey(handle.toLowerCase()));
    if (!Array.isArray(key) || key.length !== 1 || typeof key[0].storage_key !== 'string') throw new NotFoundException({ outcome: 'UNAVAILABLE' });
    let bytes: Buffer | null;
    try {
      bytes = await this.store.get(key[0].storage_key, AbortSignal.timeout(MEDIA_READ_BUDGET_MS));
    } catch {
      return unavailable();
    }
    if (bytes === null) throw new NotFoundException({ outcome: 'UNAVAILABLE' });
    return bytes;
  }

  // ---- S6-07 (CP4): Export My Data. The same decisions as the media route, on the reader's own token; every failure
  // throws (the export answers 503, never a partial package), and nothing here is ever logged.

  /** The caller's own renditions that still exist (0168), decoded strictly. */
  async ownRenditionsForExport(token: string): Promise<readonly OwnExportRendition[]> {
    const rows: unknown = await this.repository.listOwnPhotoRenditions(token);
    if (!Array.isArray(rows)) throw new Error('introduction export renditions out of shape');
    return rows.map((row: OwnRenditionRow) => {
      if (!keysAre(row, RENDITION_COLUMNS) || !isUuid(row.world_id) || typeof row.introduction_started_at !== 'string'
          || Number.isNaN(Date.parse(row.introduction_started_at)) || !(row.stage === 1 || row.stage === 2 || row.stage === 3)
          || !isUuid(row.media_handle) || typeof row.is_shared !== 'boolean') throw new Error('introduction export rendition out of shape');
      return {
        worldId: row.world_id.toLowerCase(), introductionStartedAt: row.introduction_started_at, stage: row.stage,
        handle: row.media_handle.toLowerCase(), shared: row.is_shared,
      };
    });
  }

  /** Is the caller allowed to receive these bytes NOW - the media route's own decision (0162), nothing wider. */
  async authorizedForExport(token: string, worldId: string, handle: string): Promise<boolean> {
    const answer: unknown = await this.repository.authorizeMedia(token, worldId, handle);
    if (!Array.isArray(answer) || answer.length !== 1 || !keysAre(answer[0], ['outcome'])) throw new Error('introduction export authorization out of shape');
    const { outcome } = answer[0] as unknown as OutcomeRow;
    if (outcome === 'AUTHORIZED') return true;
    if (outcome === 'UNAVAILABLE') return false;
    throw new Error('introduction export authorization out of vocabulary');
  }

  /**
   * The bytes of one of the caller's own renditions: authorized on the caller's token immediately before the key is
   * read, exactly as the media route does. NOT_AVAILABLE when the database refuses or holds no key any more (it was just
   * removed); ExportMediaIntegrityError when the store has no object for a live key; any other failure throws.
   */
  async ownMediaForExport(token: string, worldId: string, handle: string, signal: AbortSignal): Promise<OwnExportMedia> {
    if (!this.store.isConfigured()) throw new Error('introduction media store is not configured');
    if (!(await this.authorizedForExport(token, worldId, handle))) return { kind: 'NOT_AVAILABLE' };
    const key: unknown = await this.repository.mediaKey(handle);
    if (!Array.isArray(key)) throw new Error('introduction export key out of shape');
    if (key.length === 0) return { kind: 'NOT_AVAILABLE' };
    if (key.length !== 1 || typeof (key[0] as { storage_key?: unknown }).storage_key !== 'string') throw new Error('introduction export key out of shape');
    const bytes = await this.store.get((key[0] as { storage_key: string }).storage_key, signal);
    if (bytes === null) throw new ExportMediaIntegrityError();
    return { kind: 'BYTES', bytes };
  }

  private async discard(token: string, world: string, series: string): Promise<void> {
    try {
      await this.repository.removeImage(token, randomUUID(), world, series);
    } catch {
      // The sweep retires an expired PENDING series on its own (its deadline), so a failed discard leaves nothing behind.
    }
  }

  private disclosedAnswer(rows: unknown, allowed: readonly string[]): { outcome: string; materialId?: string; disclosedAt?: string } {
    if (!Array.isArray(rows) || rows.length !== 1 || !keysAre(rows[0], ['outcome', 'disclosed_material_id', 'disclosed_at'])) return unavailable();
    const row = rows[0] as { outcome: string; disclosed_material_id: string | null; disclosed_at: string | null };
    if (!allowed.includes(row.outcome)) return unavailable();
    if (row.outcome === 'DISCLOSED') {
      if (!isUuid(row.disclosed_material_id) || typeof row.disclosed_at !== 'string') return unavailable();
      return { outcome: 'DISCLOSED', materialId: row.disclosed_material_id, disclosedAt: row.disclosed_at };
    }
    return { outcome: row.outcome };
  }

  private outcomeAnswer(rows: unknown, allowed: readonly string[]): { outcome: string } {
    if (!Array.isArray(rows) || rows.length !== 1 || !keysAre(rows[0], ['outcome'])) return unavailable();
    const outcome = (rows[0] as unknown as OutcomeRow).outcome;
    return allowed.includes(outcome) ? { outcome } : unavailable();
  }

  private async guard<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof DataApiError && error.status === 400 && readDataApiUpstreamIdentity(error).databaseCode === '22023') return invalid();
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException || error instanceof NotFoundException) throw error;
      return unavailable();
    }
  }
}
