/**
 * S6-06 (CP2) — the client for what a human shares in their own Introduction, the three-stage photo, the display-name
 * consent, and every share they made in any Introduction (CP1, migration 0162):
 *
 *   GET  /introductions/worlds/:worldId/disclosures                 — READY view | UNAVAILABLE
 *   POST /introductions/worlds/:worldId/disclosures/text            — DISCLOSED | CONTACT_REFUSED | NOT_AVAILABLE_NOW | DELETED | …
 *   POST /introductions/worlds/:worldId/image/:commandId  (raw bytes) — READY | IMAGE_REFUSED | PHOTO_ACTIVE | NOT_AVAILABLE_NOW | …
 *   POST /introductions/worlds/:worldId/image-stages                — DISCLOSED | RETIRED | NOT_AVAILABLE_NOW | DELETED | …
 *   POST /introductions/worlds/:worldId/image-removal               — REMOVED | UNAVAILABLE
 *   GET  /introductions/worlds/:worldId/media/:handle               — the bytes of ONE rendition, re-authorized now
 *   POST /introductions/worlds/:worldId/display-name/grant|revoke   — GRANTED | NOT_SHARED | … / REVOKED | …
 *   GET  /introductions/shares                                      — the reader's own shares, per Introduction World
 *
 * Deleting a text share is the existing Shared owner deletion (R-5), on the Shared client; it is not repeated here.
 *
 * A transport and nothing else: no credential of its own (the AC-01 request-time seam its caller hands it), no user id,
 * no counterpart, no state, no retry, no persistence. It decodes STRICTLY — an extra field, an unknown outcome or a
 * share that is not exactly one of the bounded kinds makes the whole answer unusable.
 *
 * A photo's bytes never become a URL: `media` fetches them on the seam, `no-store`, and hands back an in-memory
 * `data:` URI for one drawing (`expo-image`, `cachePolicy: 'none'`). The server answers `Cache-Control: no-store,
 * private`, so neither platform's HTTP cache keeps them. Nothing here writes a file.
 */
/** The three text kinds a human may share (D-10), and the four personal keys (D-11). Nothing else exists. */
export type IntroductionTextType = 'FULL_NAME' | 'CONTACT_METHOD' | 'DEEPER_PERSONAL_FIELD';
export type IntroductionPersonalKey = 'work_field' | 'education' | 'hometown_city' | 'about_me';
export const INTRODUCTION_TEXT_TYPES: readonly IntroductionTextType[] = Object.freeze(['FULL_NAME', 'CONTACT_METHOD', 'DEEPER_PERSONAL_FIELD']);
export const INTRODUCTION_PERSONAL_KEYS: readonly IntroductionPersonalKey[] = Object.freeze(['work_field', 'education', 'hometown_city', 'about_me']);
/** The server's own bounds (CP1): every shared text, and the home town (D-11). */
export const INTRODUCTION_TEXT_MAX_LENGTH = 512;
export const INTRODUCTION_HOMETOWN_MAX_LENGTH = 64;
/** The server's own bounds on one photo (CP1 pipeline): JPEG, PNG or WebP, at most 10 MB. */
export const INTRODUCTION_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const INTRODUCTION_IMAGE_TYPES: readonly string[] = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

export type IntroductionStage = 1 | 2 | 3;
export type IntroductionShareState = 'ACTIVE' | 'ENDED' | 'SHARED_WORLD';

/** One share as the reader may see it: their own (`mine`) or the other person's. */
export type IntroductionShare =
  | {
    readonly kind: 'TEXT'; readonly mine: boolean; readonly materialId: string; readonly versionId: string;
    readonly textType: IntroductionTextType; readonly fieldKey: IntroductionPersonalKey | null; readonly text: string; readonly establishedAt: string;
  }
  | {
    readonly kind: 'IMAGE'; readonly mine: boolean; readonly materialId: string; readonly versionId: string;
    readonly stage: IntroductionStage; readonly handle: string;
    /** The reader's own series; never the other person's (the server never says it). */
    readonly seriesId: string | null; readonly establishedAt: string;
  };

/** The reader's own photo while some of its stages are still unshared: what they may preview and share next. */
export interface IntroductionMyPhoto {
  readonly seriesId: string;
  readonly state: 'PENDING' | 'READY' | 'DISCLOSING';
  /** Oldest stage first. */
  readonly unsharedStages: readonly { readonly stage: IntroductionStage; readonly handle: string }[];
}

export interface IntroductionDisclosures {
  readonly introductionState: IntroductionShareState;
  /** Oldest first, as the server ordered them. */
  readonly items: readonly IntroductionShare[];
  readonly myPhoto: IntroductionMyPhoto | null;
  /** The FULL_NAME version the reader currently shows instead of their first name in this World, or null. */
  readonly myDisplayedVersionId: string | null;
  /** The other person's full name, only while THEY consent to show it to this reader (D-09); null otherwise. */
  readonly otherDisplayName: string | null;
}

export type IntroductionDisclosuresRead =
  | { readonly kind: 'READY'; readonly view: IntroductionDisclosures }
  | { readonly kind: 'UNAVAILABLE' | 'FAILED' | 'OFFLINE' };

/** A text or a stage: DISCLOSED, or what the server said instead. FAILED / OFFLINE: not known; retry with the SAME id. */
export type IntroductionDiscloseResult =
  | { readonly kind: 'DISCLOSED'; readonly materialId: string; readonly disclosedAt: string }
  | { readonly kind: 'CONTACT_REFUSED' | 'RETIRED' | 'NOT_AVAILABLE_NOW' | 'DELETED' | 'COMMAND_CONFLICT' | 'UNAVAILABLE' | 'INVALID' | 'FAILED' | 'OFFLINE' };

/** The pipeline's refusals (CP1): every one is said the same way to the reader (PD-27). */
export type IntroductionImageRefusal = 'TOO_LARGE' | 'UNSUPPORTED' | 'MALFORMED' | 'TOO_SMALL' | 'OTHER';
export type IntroductionUploadResult =
  | { readonly kind: 'READY'; readonly seriesId: string }
  | { readonly kind: 'IMAGE_REFUSED'; readonly reason: IntroductionImageRefusal }
  | { readonly kind: 'PHOTO_ACTIVE' | 'NOT_AVAILABLE_NOW' | 'REMOVED' | 'COMMAND_CONFLICT' | 'UNAVAILABLE' | 'INVALID' | 'FAILED' | 'OFFLINE' };

export type IntroductionRemoveResult = { readonly kind: 'REMOVED' | 'UNAVAILABLE' | 'INVALID' | 'FAILED' | 'OFFLINE' };
export type IntroductionGrantResult = { readonly kind: 'GRANTED' | 'NOT_SHARED' | 'NOT_AVAILABLE_NOW' | 'COMMAND_CONFLICT' | 'UNAVAILABLE' | 'INVALID' | 'FAILED' | 'OFFLINE' };
export type IntroductionRevokeResult = { readonly kind: 'REVOKED' | 'COMMAND_CONFLICT' | 'UNAVAILABLE' | 'INVALID' | 'FAILED' | 'OFFLINE' };
/** DRAWABLE: an in-memory `data:image/jpeg;base64,…` for one drawing. UNAVAILABLE: refused now (deleted, not shared, not theirs). */
export type IntroductionMediaRead =
  | { readonly kind: 'DRAWABLE'; readonly dataUri: string }
  | { readonly kind: 'UNAVAILABLE' | 'FAILED' | 'OFFLINE' };

/** One of the reader's own shares in the Settings page (P16). */
export type IntroductionOwnShare =
  | {
    readonly kind: 'TEXT'; readonly materialId: string; readonly versionId: string; readonly textType: IntroductionTextType;
    readonly fieldKey: IntroductionPersonalKey | null; readonly text: string; readonly displayed: boolean; readonly establishedAt: string;
  }
  | { readonly kind: 'IMAGE'; readonly materialId: string; readonly versionId: string; readonly seriesId: string; readonly stage: IntroductionStage; readonly establishedAt: string };
export interface IntroductionSharesWorld {
  readonly worldId: string;
  readonly introductionState: IntroductionShareState;
  /** The first name the server presents to this reader for the other person, or null. */
  readonly otherFirstName: string | null;
  readonly shares: readonly IntroductionOwnShare[];
}
export type IntroductionSharesRead =
  | { readonly kind: 'READY'; readonly worlds: readonly IntroductionSharesWorld[] }
  | { readonly kind: 'FAILED' | 'OFFLINE' };

/** The seam's fetch, able to carry a photo's raw bytes and to hand back a rendition's. */
export type IntroductionSharingFetch = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string | Uint8Array; cache?: 'no-store' },
) => Promise<{ readonly ok: boolean; readonly status: number; json(): Promise<unknown>; blob(): Promise<Blob> }>;

export interface IntroductionSharingApiConfig {
  readonly baseUrl: string;
  readonly fetch: IntroductionSharingFetch;
  /** Reads a fetched rendition into a `data:` URI in memory. Default: the platform's FileReader, then the Blob is closed. */
  readonly toDataUri?: (blob: Blob) => Promise<string>;
}

/** The platform FileReader turns the in-memory Blob into a `data:` URI; the Blob is released at once. */
export const blobToDataUri = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    (blob as Blob & { close?: () => void }).close?.();
    if (typeof reader.result === 'string') resolve(reader.result);
    else reject(new Error('not readable'));
  };
  reader.onerror = () => {
    (blob as Blob & { close?: () => void }).close?.();
    reject(new Error('not readable'));
  };
  reader.readAsDataURL(blob);
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;
const DATA_URI = /^data:[^;,]*;base64,([A-Za-z0-9+/]+={0,2})$/u;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isInstant = (value: unknown): value is string => typeof value === 'string' && INSTANT.test(value);
const isStage = (value: unknown): value is IntroductionStage => value === 1 || value === 2 || value === 3;
const isState = (value: unknown): value is IntroductionShareState => value === 'ACTIVE' || value === 'ENDED' || value === 'SHARED_WORLD';
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};
const lower = (value: string): string => value.toLowerCase();

/** The text kind and key, coherent with each other (a key exactly for a personal share), or null. */
function textKind(type: unknown, key: unknown): { readonly textType: IntroductionTextType; readonly fieldKey: IntroductionPersonalKey | null } | null {
  if (!INTRODUCTION_TEXT_TYPES.includes(type as IntroductionTextType)) return null;
  if (type === 'DEEPER_PERSONAL_FIELD') return INTRODUCTION_PERSONAL_KEYS.includes(key as IntroductionPersonalKey) ? { textType: type, fieldKey: key as IntroductionPersonalKey } : null;
  return key === null ? { textType: type as IntroductionTextType, fieldKey: null } : null;
}
/** A photo stage's kind as the core keeps it: the clear stage is FULL_IMAGE, the two blurred ones PARTIAL_IMAGE. */
const imageKindFits = (type: unknown, stage: IntroductionStage): boolean => type === (stage === 3 ? 'FULL_IMAGE' : 'PARTIAL_IMAGE');

const ITEM_KEYS = ['kind', 'mine', 'materialId', 'versionId', 'resourceType', 'fieldKey', 'text', 'stage', 'handle', 'seriesId', 'establishedAt'];

/** One share of a World, or `null` when anything is doubtful — the other person's series included. */
export function decodeIntroductionShare(value: unknown): IntroductionShare | null {
  if (!isRecord(value) || !hasExactly(value, ITEM_KEYS)) return null;
  const { kind, mine, materialId, versionId, resourceType, fieldKey, text, stage, handle, seriesId, establishedAt } = value;
  if (typeof mine !== 'boolean' || !isUuid(materialId) || !isUuid(versionId) || !isInstant(establishedAt)) return null;
  if (kind === 'TEXT') {
    const fits = textKind(resourceType, fieldKey);
    if (fits === null || typeof text !== 'string' || text.length === 0 || stage !== null || handle !== null || seriesId !== null) return null;
    return Object.freeze({ kind, mine, materialId: lower(materialId), versionId: lower(versionId), ...fits, text, establishedAt });
  }
  if (kind !== 'IMAGE' || !isStage(stage) || !imageKindFits(resourceType, stage) || !isUuid(handle) || fieldKey !== null || text !== null) return null;
  // The counterpart never learns the owner's series; the reader always knows their own.
  if (mine ? !isUuid(seriesId) : seriesId !== null) return null;
  return Object.freeze({
    kind, mine, materialId: lower(materialId), versionId: lower(versionId), stage, handle: lower(handle),
    seriesId: seriesId === null ? null : lower(seriesId as string), establishedAt,
  });
}

function decodeMyPhoto(value: unknown): IntroductionMyPhoto | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !hasExactly(value, ['seriesId', 'state', 'unsharedStages']) || !isUuid(value.seriesId)) return undefined;
  if ((value.state !== 'PENDING' && value.state !== 'READY' && value.state !== 'DISCLOSING') || !Array.isArray(value.unsharedStages)) return undefined;
  const stages = value.unsharedStages.map((s) => (isRecord(s) && hasExactly(s, ['stage', 'handle']) && isStage(s.stage) && isUuid(s.handle)
    ? Object.freeze({ stage: s.stage, handle: lower(s.handle) }) : null));
  if (stages.length === 0 || stages.some((s) => s === null)) return undefined;
  const ordered = stages as { readonly stage: IntroductionStage; readonly handle: string }[];
  if (ordered.some((s, i) => i > 0 && s.stage <= ordered[i - 1].stage)) return undefined;
  return Object.freeze({ seriesId: lower(value.seriesId), state: value.state, unsharedStages: Object.freeze(ordered) });
}

/** The READY body of a World's disclosures, or `null`. */
export function decodeIntroductionDisclosures(body: unknown): IntroductionDisclosures | null {
  if (!isRecord(body) || !hasExactly(body, ['outcome', 'introductionState', 'items', 'myPhoto', 'myDisplayedVersionId', 'otherDisplayName'])) return null;
  const { outcome, introductionState, items, myPhoto, myDisplayedVersionId, otherDisplayName } = body;
  if (outcome !== 'READY' || !isState(introductionState) || !Array.isArray(items)) return null;
  if (!(myDisplayedVersionId === null || isUuid(myDisplayedVersionId))) return null;
  if (!(otherDisplayName === null || (typeof otherDisplayName === 'string' && otherDisplayName.trim().length > 0))) return null;
  const decoded = items.map(decodeIntroductionShare);
  if (decoded.some((item) => item === null) || new Set(decoded.map((item) => item!.versionId)).size !== decoded.length) return null;
  const photo = decodeMyPhoto(myPhoto);
  if (photo === undefined) return null;
  // Unshared stages exist only while the Introduction lives (0162).
  if (photo !== null && introductionState !== 'ACTIVE') return null;
  return Object.freeze({
    introductionState, items: Object.freeze(decoded as IntroductionShare[]), myPhoto: photo,
    myDisplayedVersionId: myDisplayedVersionId === null ? null : lower(myDisplayedVersionId), otherDisplayName: otherDisplayName as string | null,
  });
}

const OWN_SHARE_KEYS = ['materialId', 'versionId', 'resourceType', 'fieldKey', 'text', 'seriesId', 'stage', 'displayed', 'establishedAt'];

function decodeOwnShare(value: unknown): IntroductionOwnShare | null {
  if (!isRecord(value) || !hasExactly(value, OWN_SHARE_KEYS)) return null;
  const { materialId, versionId, resourceType, fieldKey, text, seriesId, stage, displayed, establishedAt } = value;
  if (!isUuid(materialId) || !isUuid(versionId) || typeof displayed !== 'boolean' || !isInstant(establishedAt)) return null;
  if (typeof text === 'string') {
    const fits = textKind(resourceType, fieldKey);
    if (fits === null || text.length === 0 || seriesId !== null || stage !== null || (displayed && fits.textType !== 'FULL_NAME')) return null;
    return Object.freeze({ kind: 'TEXT', materialId: lower(materialId), versionId: lower(versionId), ...fits, text, displayed, establishedAt });
  }
  if (text !== null || fieldKey !== null || !isStage(stage) || !imageKindFits(resourceType, stage) || !isUuid(seriesId) || displayed) return null;
  return Object.freeze({ kind: 'IMAGE', materialId: lower(materialId), versionId: lower(versionId), seriesId: lower(seriesId), stage, establishedAt });
}

/** The reader's own shares, per World, or `null`. */
export function decodeIntroductionShares(body: unknown): readonly IntroductionSharesWorld[] | null {
  if (!isRecord(body) || !hasExactly(body, ['outcome', 'worlds']) || body.outcome !== 'READY' || !Array.isArray(body.worlds)) return null;
  const worlds: IntroductionSharesWorld[] = [];
  for (const world of body.worlds) {
    if (!isRecord(world) || !hasExactly(world, ['worldId', 'introductionState', 'otherFirstName', 'shares'])) return null;
    const { worldId, introductionState, otherFirstName, shares } = world;
    if (!isUuid(worldId) || !isState(introductionState) || !Array.isArray(shares)) return null;
    if (!(otherFirstName === null || (typeof otherFirstName === 'string' && otherFirstName.trim().length > 0))) return null;
    const decoded = shares.map(decodeOwnShare);
    if (decoded.some((s) => s === null)) return null;
    worlds.push(Object.freeze({ worldId: lower(worldId), introductionState, otherFirstName: otherFirstName as string | null, shares: Object.freeze(decoded as IntroductionOwnShare[]) }));
  }
  if (new Set(worlds.map((w) => w.worldId)).size !== worlds.length) return null;
  return Object.freeze(worlds);
}

/** A body that is exactly `{ outcome }` with one of the given words, or `null`. */
function bareOutcome<T extends string>(body: unknown, allowed: readonly T[]): T | null {
  if (!isRecord(body) || !hasExactly(body, ['outcome'])) return null;
  return allowed.find((word) => word === body.outcome) ?? null;
}

const REFUSALS: readonly IntroductionImageRefusal[] = ['TOO_LARGE', 'UNSUPPORTED', 'MALFORMED', 'TOO_SMALL'];

type Exchange =
  | { readonly kind: 'OK'; readonly body: unknown }
  | { readonly kind: 'STATUS'; readonly status: number }
  | { readonly kind: 'NETWORK' };

/** The signed-in sharing client. Built on the AC-01 seam bound to one identity. */
export class IntroductionSharingApiClient {
  constructor(private readonly config: IntroductionSharingApiConfig) {}

  async disclosures(worldId: string): Promise<IntroductionDisclosuresRead> {
    const answer = await this.exchange('GET', `${this.world(worldId)}/disclosures`);
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind !== 'OK') return { kind: 'FAILED' };
    const view = decodeIntroductionDisclosures(answer.body);
    if (view !== null) return { kind: 'READY', view };
    return { kind: bareOutcome(answer.body, ['UNAVAILABLE'] as const) ?? 'FAILED' };
  }

  async shareText(worldId: string, commandId: string, textType: IntroductionTextType, fieldKey: IntroductionPersonalKey | null, text: string): Promise<IntroductionDiscloseResult> {
    const answer = await this.exchange('POST', `${this.world(worldId)}/disclosures/text`, { commandId, resourceType: textType, fieldKey, text });
    return this.disclosed(answer, ['CONTACT_REFUSED', 'NOT_AVAILABLE_NOW', 'DELETED', 'COMMAND_CONFLICT', 'UNAVAILABLE']);
  }

  /** One photo's raw bytes, in memory; the server decides everything else (the intent first, then the pipeline). */
  async uploadImage(worldId: string, commandId: string, bytes: Uint8Array, mimeType: string): Promise<IntroductionUploadResult> {
    let response: Awaited<ReturnType<IntroductionSharingFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}${this.world(worldId)}/image/${encodeURIComponent(commandId)}`, {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': mimeType }, body: bytes,
      });
    } catch {
      return { kind: 'OFFLINE' };
    }
    if (!response.ok) return { kind: response.status === 400 ? 'INVALID' : 'FAILED' };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'FAILED' };
    }
    if (isRecord(body) && hasExactly(body, ['outcome', 'seriesId']) && body.outcome === 'READY' && isUuid(body.seriesId)) return { kind: 'READY', seriesId: lower(body.seriesId) };
    if (isRecord(body) && hasExactly(body, ['outcome', 'reason']) && body.outcome === 'IMAGE_REFUSED' && typeof body.reason === 'string') {
      return { kind: 'IMAGE_REFUSED', reason: REFUSALS.find((r) => r === body.reason) ?? 'OTHER' };
    }
    return { kind: bareOutcome(body, ['PHOTO_ACTIVE', 'NOT_AVAILABLE_NOW', 'REMOVED', 'COMMAND_CONFLICT', 'UNAVAILABLE'] as const) ?? 'FAILED' };
  }

  async shareStage(worldId: string, commandId: string, seriesId: string, stage: IntroductionStage): Promise<IntroductionDiscloseResult> {
    const answer = await this.exchange('POST', `${this.world(worldId)}/image-stages`, { commandId, seriesId, stage });
    return this.disclosed(answer, ['RETIRED', 'NOT_AVAILABLE_NOW', 'DELETED', 'COMMAND_CONFLICT', 'UNAVAILABLE']);
  }

  async removeImage(worldId: string, commandId: string, seriesId: string): Promise<IntroductionRemoveResult> {
    const answer = await this.exchange('POST', `${this.world(worldId)}/image-removal`, { commandId, seriesId });
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind === 'STATUS') return { kind: answer.status === 400 ? 'INVALID' : 'FAILED' };
    return { kind: bareOutcome(answer.body, ['REMOVED', 'UNAVAILABLE'] as const) ?? 'FAILED' };
  }

  async grantDisplayName(worldId: string, commandId: string, versionId: string): Promise<IntroductionGrantResult> {
    const answer = await this.exchange('POST', `${this.world(worldId)}/display-name/grant`, { commandId, versionId });
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind === 'STATUS') return { kind: answer.status === 400 ? 'INVALID' : 'FAILED' };
    return { kind: bareOutcome(answer.body, ['GRANTED', 'NOT_SHARED', 'NOT_AVAILABLE_NOW', 'COMMAND_CONFLICT', 'UNAVAILABLE'] as const) ?? 'FAILED' };
  }

  async revokeDisplayName(worldId: string, commandId: string): Promise<IntroductionRevokeResult> {
    const answer = await this.exchange('POST', `${this.world(worldId)}/display-name/revoke`, { commandId });
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind === 'STATUS') return { kind: answer.status === 400 ? 'INVALID' : 'FAILED' };
    return { kind: bareOutcome(answer.body, ['REVOKED', 'COMMAND_CONFLICT', 'UNAVAILABLE'] as const) ?? 'FAILED' };
  }

  /** The bytes of one rendition, asked for afresh: the server re-authorizes this reader on this request. */
  async media(worldId: string, handle: string): Promise<IntroductionMediaRead> {
    let response: Awaited<ReturnType<IntroductionSharingFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}${this.world(worldId)}/media/${encodeURIComponent(handle)}`, {
        method: 'GET', headers: { Accept: 'image/jpeg' }, cache: 'no-store',
      });
    } catch {
      return { kind: 'OFFLINE' };
    }
    if (response.status === 404) return { kind: 'UNAVAILABLE' };
    if (!response.ok) return { kind: 'FAILED' };
    try {
      const uri = await (this.config.toDataUri ?? blobToDataUri)(await response.blob());
      const base64 = DATA_URI.exec(uri)?.[1];
      // Only a non-empty base64 image is drawn; the type is the server's one rendition format.
      return base64 === undefined || base64.length === 0 ? { kind: 'FAILED' } : { kind: 'DRAWABLE', dataUri: `data:image/jpeg;base64,${base64}` };
    } catch {
      return { kind: 'FAILED' };
    }
  }

  async shares(): Promise<IntroductionSharesRead> {
    const answer = await this.exchange('GET', '/introductions/shares');
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind !== 'OK') return { kind: 'FAILED' };
    const worlds = decodeIntroductionShares(answer.body);
    return worlds === null ? { kind: 'FAILED' } : { kind: 'READY', worlds };
  }

  private disclosed(answer: Exchange, allowed: readonly Exclude<IntroductionDiscloseResult['kind'], 'DISCLOSED' | 'INVALID' | 'FAILED' | 'OFFLINE'>[]): IntroductionDiscloseResult {
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind === 'STATUS') return { kind: answer.status === 400 ? 'INVALID' : 'FAILED' };
    const body = answer.body;
    if (isRecord(body) && hasExactly(body, ['outcome', 'materialId', 'disclosedAt']) && body.outcome === 'DISCLOSED' && isUuid(body.materialId) && isInstant(body.disclosedAt)) {
      return { kind: 'DISCLOSED', materialId: lower(body.materialId), disclosedAt: body.disclosedAt };
    }
    return { kind: bareOutcome(body, allowed) ?? 'FAILED' };
  }

  private world(worldId: string): string {
    return `/introductions/worlds/${encodeURIComponent(worldId)}`;
  }

  /** The decoded JSON of a 2xx, the status of any other answer, or NETWORK. Never thrown. */
  private async exchange(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<Exchange> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      if (!response.ok) return { kind: 'STATUS', status: response.status };
      return { kind: 'OK', body: (await response.json()) as unknown };
    } catch {
      return { kind: 'NETWORK' };
    }
  }
}

