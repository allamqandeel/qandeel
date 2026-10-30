import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import {
  ExportMediaIntegrityError, IntroductionDisclosureService, type OwnExportRendition,
} from '../introductions-disclosure/introduction-disclosure.service';
import { TelemetryService } from '../observability/telemetry.service';
import { VoiceMediaService, type OpenedAudio, type VoiceExportManifest } from '../voice-media/voice-media.service';
import { PrivacyDataRepository, type DeletionActRow, type ExportRequestRow } from './privacy-data.repository';
import { SupabasePasswordGrantService } from './supabase-password-grant.service';

/**
 * W3-MEGA-S — Privacy & Data, the server side: Export My Data (E2E-D-16) and the Personal-world Delete Account
 * (E2E-D-17), exactly the W3-PDG-01 §7 / §8 journeys marked PO.
 *
 * Every route acts for the CALLER only: the account is the verified token's, and no body carries an account or any
 * other identifier as authority. Nothing is logged: no password, token, Email, package or state.
 *
 * ## Re-authentication — reused, not rebuilt
 *
 * Both requests begin with the owner's current password, spent on the provider's OWN password grant for the caller's
 * own Email through W2-01's relay — the mechanism W3-MEGA-A already uses. The request is then made on the PROOF token,
 * and the database refuses it without that token's recent password authentication (0129's check, reused by 0130). The
 * proof session is ended at once, whatever happens.
 *
 * ## What each answer means
 *
 *   ACCEPTED           the request is held (a replay or a second request answers the one already held);
 *   PASSWORD_REJECTED  the provider refused the re-entered password; nothing was requested;
 *   CANCELLED / NONE / NOT_CANCELLABLE  a cancellation's truth (NOT_CANCELLABLE: the grace period is over);
 *   503                no usable answer: the client never guesses, it re-reads the state.
 *
 * The export package is downloadable only by its owner, only while READY and within its availability; the owner's
 * Email is added here from the owner's own provider session (the provider holds it; the database never stores it).
 *
 * ## S6-07 (CP4) — the export bundle: the package and the reader's own photos (QAN-BL-PRIV-04, Q7′ / Q7″)
 *
 *   GET …/export/download                 unchanged: the package only;
 *   GET …/export/download/bundle          the SAME package object, a photo manifest beside it (never inside it), the
 *                                         leading photo files inline (base64) while they fit the one-answer guard, and
 *                                         a manifest token;
 *   GET …/export/download/bundle/files/:fileName   one listed photo file, for the files that did not fit, under the
 *                                         token (header `x-qandeel-export-manifest`): CHANGED (409) when the reader's
 *                                         photos are no longer the ones the manifest names.
 *
 * Every photo is the reader's OWN rendition (0168's owner-only reader), re-authorized on the reader's own token at every
 * request by the media route's own decision (0162), and only then read from the store. The 32 MiB guard bounds ONE
 * answer, never the export: a photo beyond it travels by the file route, so every photo the reader may download can be
 * exported. No handle, key, World id or URL is ever answered; the token is a one-way digest of the manifest's internal
 * identities. A store with no object for a live key, or any transport failure, is 503: never a partial bundle sold as
 * complete. A photo the reader may no longer download is listed in `notIncluded` (NO_LONGER_AVAILABLE), never silently
 * missing.
 *
 * ## S8B-02 (CP2) — the reader's own voice recordings (contract §3.11, B9)
 *
 *   GET …/export/download/bundle          also answers `voiceManifest` (`qandeel.personal-data-export.voice.v1`) BESIDE
 *                                         the photo manifest: every voice object the owner may read now, by file name.
 *                                         Nothing inline, never base64; no key, recording id or URL. The photo manifest,
 *                                         its files and its token are unchanged.
 *   GET …/export/download/bundle/voice/:fileName   one listed voice file, STREAMED, while the export is READY; the name
 *                                         is resolved again and the object re-read through the database's read definer at
 *                                         that instant, so an expired, deleted or erased recording answers
 *                                         NO_LONGER_AVAILABLE. Today's mobile client ignores the voice manifest; S8B-03
 *                                         saves the files on the device.
 */
export const EXPORT_BUNDLE_INLINE_MAX_BYTES = 32 * 1024 * 1024;
export const EXPORT_BUNDLE_ASSEMBLY_MS = 20_000;
export const EXPORT_BUNDLE_FILE_MS = 15_000;
export const EXPORT_PHOTO_MANIFEST_FORMAT = 'qandeel.personal-data-export.photos.v1';
export const EXPORT_MANIFEST_HEADER = 'x-qandeel-export-manifest';
const EXPORT_PHOTO_FILE_NAME = /^qandeel-photo-\d{2,4}-stage-[123]\.jpg$/u;
const MANIFEST_TOKEN = /^[0-9a-f]{64}$/u;

interface ManifestEntry extends OwnExportRendition { readonly fileName: string }
export interface PhotoManifest {
  readonly format: typeof EXPORT_PHOTO_MANIFEST_FORMAT;
  readonly files: ReadonlyArray<{ fileName: string; mimeType: 'image/jpeg'; stage: number; shared: boolean; introductionStartedAt: string; derivedRendition: true }>;
  readonly notIncluded: ReadonlyArray<{ introductionStartedAt: string; stage: number; reason: 'NO_LONGER_AVAILABLE' }>;
}
export interface PhotoFile { readonly fileName: string; readonly bytes: number; readonly bytesBase64: string }

/** Each Introduction with a photo is numbered by when it started (then by World); a file is that number and its stage. */
function manifestEntries(renditions: readonly OwnExportRendition[]): ManifestEntry[] {
  const ordered = [...renditions].sort((x, y) => Date.parse(x.introductionStartedAt) - Date.parse(y.introductionStartedAt)
    || (x.worldId < y.worldId ? -1 : x.worldId > y.worldId ? 1 : 0) || x.stage - y.stage);
  const numberOf = new Map<string, number>();
  return ordered.map((r) => {
    if (!numberOf.has(r.worldId)) numberOf.set(r.worldId, numberOf.size + 1);
    return { ...r, fileName: `qandeel-photo-${String(numberOf.get(r.worldId)).padStart(2, '0')}-stage-${r.stage}.jpg` };
  });
}

/** One-way: the export's availability and the manifest's internal identities, in order. Names nothing. */
function manifestToken(availableUntil: string | null, entries: readonly ManifestEntry[]): string {
  return createHash('sha256').update(JSON.stringify([availableUntil, entries.map((e) => [e.fileName, e.worldId, e.handle, e.stage])]), 'utf8').digest('hex');
}
export const EXPORT_STATUSES = Object.freeze(['NONE', 'PREPARING', 'READY', 'EXPIRED', 'FAILED'] as const);
export const DELETION_STATUSES = Object.freeze(['NONE', 'SCHEDULED', 'FINALIZING', 'BLOCKED'] as const);
export type ExportStatus = (typeof EXPORT_STATUSES)[number];
export type DeletionStatus = (typeof DELETION_STATUSES)[number];

export interface PrivacyStateView {
  readonly export: { readonly status: ExportStatus; readonly availableUntil: string | null };
  readonly deletion: { readonly status: DeletionStatus; readonly finalAt: string | null };
}

const COMMAND_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export const PRIVACY_MAX_PASSWORD = 1024;

const unavailable = () => new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
const changed = () => new ConflictException({ outcome: 'CHANGED' });
const invalid = () => new BadRequestException({ outcome: 'INVALID_REQUEST' });

/** Exactly `{ commandId, password }`: a UUID command identity and a non-empty password within its bound. */
function commandWithPassword(body: unknown): { readonly commandId: string; readonly password: string } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 2 || keys[0] !== 'commandId' || keys[1] !== 'password') throw invalid();
  const { commandId, password } = record;
  if (typeof commandId !== 'string' || !COMMAND_ID_PATTERN.test(commandId)) throw invalid();
  if (typeof password !== 'string' || password === '' || password.length > PRIVACY_MAX_PASSWORD) throw invalid();
  return { commandId, password };
}

/** Exactly `{}`. */
function emptyBody(body: unknown): void {
  if (body === null || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 0) throw invalid();
}

function exportStatus(value: unknown): ExportStatus {
  if (typeof value === 'string' && (EXPORT_STATUSES as readonly string[]).includes(value)) return value as ExportStatus;
  throw unavailable();
}

function deletionStatus(value: unknown): DeletionStatus {
  if (typeof value === 'string' && (DELETION_STATUSES as readonly string[]).includes(value)) return value as DeletionStatus;
  throw unavailable();
}

/** One instant form for the client: the database's timestamptz (microseconds, offset) as ISO-8601 UTC; unreadable → null. */
const instant = (value: unknown): string | null => {
  if (typeof value !== 'string' || value === '') return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : new Date(at).toISOString();
};

@Injectable()
export class PrivacyDataService {
  constructor(
    private readonly repository: PrivacyDataRepository,
    private readonly provider: SupabasePasswordGrantService,
    @Optional() private readonly photos?: IntroductionDisclosureService,
    @Optional() private readonly telemetry?: TelemetryService,
    @Optional() private readonly voice?: VoiceMediaService,
  ) {}

  async readState(accessToken: string): Promise<PrivacyStateView> {
    const row = await this.repository.readState(accessToken).catch(() => {
      throw unavailable();
    });
    if (row === undefined) throw unavailable();
    return {
      export: { status: exportStatus(row.export_status), availableUntil: instant(row.export_available_until) },
      deletion: { status: deletionStatus(row.deletion_status), finalAt: instant(row.deletion_final_at) },
    };
  }

  async requestExport(accessToken: string, body: unknown, clientIp: string | undefined) {
    const { commandId, password } = commandWithPassword(body);
    const ip = this.requireConfigured(clientIp);
    const proof = await this.prove(accessToken, password, ip);
    if (proof === 'PASSWORD_REJECTED') return { outcome: 'PASSWORD_REJECTED' as const };
    let row: ExportRequestRow | undefined;
    try {
      row = await this.repository.requestExport(proof, commandId);
    } catch {
      throw unavailable();
    } finally {
      await this.provider.endSessions(proof, 'local', ip);
    }
    if (row === undefined || row.outcome !== 'ACCEPTED') throw unavailable();
    return { outcome: 'ACCEPTED' as const, export: { status: exportStatus(row.export_status), availableUntil: instant(row.available_until) } };
  }

  /** The owner's ready package, with the owner's own Email added; otherwise its status alone. */
  async downloadExport(accessToken: string, clientIp: string | undefined) {
    const row = await this.repository.readExport(accessToken).catch(() => {
      throw unavailable();
    });
    if (row === undefined) throw unavailable();
    const status = exportStatus(row.export_status);
    if (status !== 'READY') return { status, availableUntil: null, package: null };
    const content = row.content;
    if (content === null || typeof content !== 'object' || Array.isArray(content)) throw unavailable();
    const ip = this.requireConfigured(clientIp);
    const owner = await this.provider.readOwnUser(accessToken, ip);
    if (owner === null) throw unavailable();
    const account = content.account !== null && typeof content.account === 'object' && !Array.isArray(content.account)
      ? (content.account as Record<string, unknown>)
      : {};
    return {
      status,
      availableUntil: instant(row.available_until),
      package: { ...content, account: { ...account, email: owner.email, emailVerified: owner.emailVerified } },
    };
  }

  /**
   * S6-07 (CP4): the bundle - exactly the package `downloadExport` answers, the photo manifest beside it, the leading
   * photo files inline while they fit EXPORT_BUNDLE_INLINE_MAX_BYTES, and the manifest token for the rest.
   */
  async downloadExportBundle(accessToken: string, clientIp: string | undefined, userId?: string) {
    const base = await this.downloadExport(accessToken, clientIp);
    if (base.status !== 'READY') {
      this.signal('bundle', 'not_ready');
      return { ...base, photoManifest: null, photoFiles: null, photoManifestToken: null, voiceManifest: null };
    }
    const signal = AbortSignal.timeout(EXPORT_BUNDLE_ASSEMBLY_MS);
    try {
      const entries = manifestEntries(await this.ownPhotos().ownRenditionsForExport(accessToken));
      const files: ManifestEntry[] = [];
      const notIncluded: PhotoManifest['notIncluded'][number][] = [];
      for (const entry of entries) {
        if (await this.ownPhotos().authorizedForExport(accessToken, entry.worldId, entry.handle)) files.push(entry);
        else notIncluded.push({ introductionStartedAt: entry.introductionStartedAt, stage: entry.stage, reason: 'NO_LONGER_AVAILABLE' });
      }
      const inline: PhotoFile[] = [];
      let inlineBytes = 0;
      for (let i = 0; i < files.length; i += 1) {
        const media = await this.ownPhotos().ownMediaForExport(accessToken, files[i].worldId, files[i].handle, signal);
        if (media.kind === 'NOT_AVAILABLE') {
          // Removed since it was authorized a moment ago: listed as no longer available, never silently missing.
          notIncluded.push({ introductionStartedAt: files[i].introductionStartedAt, stage: files[i].stage, reason: 'NO_LONGER_AVAILABLE' });
          files.splice(i, 1);
          i -= 1;
          continue;
        }
        // The guard bounds this ONE answer: the first file that does not fit, and every file after it, travel by the file
        // route instead (the bytes just read are dropped). It never bounds what the reader may export.
        if (inlineBytes + media.bytes.length > EXPORT_BUNDLE_INLINE_MAX_BYTES) break;
        inlineBytes += media.bytes.length;
        inline.push({ fileName: files[i].fileName, bytes: media.bytes.length, bytesBase64: media.bytes.toString('base64') });
      }
      const photoManifest: PhotoManifest = {
        format: EXPORT_PHOTO_MANIFEST_FORMAT,
        files: files.map((f) => ({ fileName: f.fileName, mimeType: 'image/jpeg', stage: f.stage, shared: f.shared,
          introductionStartedAt: f.introductionStartedAt, derivedRendition: true })),
        notIncluded,
      };
      // S8B-02 (CP2): the voice manifest, beside the photo manifest; a voice listing failure fails the bundle (never partial).
      const voiceManifest: VoiceExportManifest | null = userId !== undefined && this.voice !== undefined ? await this.voice.exportManifest(userId) : null;
      this.signal('bundle', 'success');
      return { ...base, photoManifest, photoFiles: inline, photoManifestToken: manifestToken(base.availableUntil, entries), voiceManifest };
    } catch (error) {
      this.signal('bundle', error instanceof ExportMediaIntegrityError ? 'integrity_failure' : 'transport_failure');
      throw unavailable();
    }
  }

  /**
   * S6-07 (CP4): one listed photo file, for the files the bundle answer did not carry. The reader's photos must still be
   * exactly the ones the manifest names (the token), the export still READY, and the file still AUTHORIZED for the reader
   * now; otherwise CHANGED and the reader's app starts the bundle again.
   */
  async downloadExportPhoto(accessToken: string, fileName: unknown, token: unknown) {
    if (typeof fileName !== 'string' || !EXPORT_PHOTO_FILE_NAME.test(fileName) || typeof token !== 'string' || !MANIFEST_TOKEN.test(token)) throw invalid();
    const row = await this.repository.readExport(accessToken).catch(() => {
      this.signal('bundle_file', 'transport_failure');
      throw unavailable();
    });
    if (row === undefined) throw unavailable();
    if (exportStatus(row.export_status) !== 'READY') {
      this.signal('bundle_file', 'superseded_expected');
      throw changed();
    }
    let answer: PhotoFile | 'CHANGED';
    try {
      const entries = manifestEntries(await this.ownPhotos().ownRenditionsForExport(accessToken));
      const entry = entries.find((e) => e.fileName === fileName);
      if (manifestToken(instant(row.available_until), entries) !== token || entry === undefined) {
        answer = 'CHANGED';
      } else {
        const media = await this.ownPhotos().ownMediaForExport(accessToken, entry.worldId, entry.handle, AbortSignal.timeout(EXPORT_BUNDLE_FILE_MS));
        answer = media.kind === 'BYTES' ? { fileName, bytes: media.bytes.length, bytesBase64: media.bytes.toString('base64') } : 'CHANGED';
      }
    } catch (error) {
      this.signal('bundle_file', error instanceof ExportMediaIntegrityError ? 'integrity_failure' : 'transport_failure');
      throw unavailable();
    }
    if (answer === 'CHANGED') {
      this.signal('bundle_file', 'superseded_expected');
      throw changed();
    }
    this.signal('bundle_file', 'success');
    return answer;
  }

  /**
   * S8B-02 (CP2): one listed voice file, streamed by the caller, while the export is READY (otherwise CHANGED, as a photo
   * file). Ownership, readability and the name are decided again by the voice service at this instant.
   */
  async openExportVoiceFile(accessToken: string, userId: string, fileName: string, signal: AbortSignal): Promise<OpenedAudio> {
    if (this.voice === undefined) throw unavailable();
    const row = await this.repository.readExport(accessToken).catch(() => {
      throw unavailable();
    });
    if (row === undefined) throw unavailable();
    if (exportStatus(row.export_status) !== 'READY') throw changed();
    return this.voice.openExportFile(userId, fileName, signal);
  }

  private ownPhotos(): IntroductionDisclosureService {
    if (this.photos === undefined) throw new Error('the photo source is not composed');
    return this.photos;
  }

  /** PROD-OPS-01's content-free channel: an operation and an outcome class, never a person, photo, size or count. */
  private signal(operation: 'bundle' | 'bundle_file', outcome: string): void {
    this.telemetry?.recordOperationalOutcome('PRIVACY_EXPORT', operation, outcome);
  }

  async requestDeletion(accessToken: string, body: unknown, clientIp: string | undefined) {
    const { commandId, password } = commandWithPassword(body);
    const ip = this.requireConfigured(clientIp);
    const proof = await this.prove(accessToken, password, ip);
    if (proof === 'PASSWORD_REJECTED') return { outcome: 'PASSWORD_REJECTED' as const };
    let row: DeletionActRow | undefined;
    try {
      row = await this.repository.requestDeletion(proof, commandId);
    } catch {
      throw unavailable();
    } finally {
      await this.provider.endSessions(proof, 'local', ip);
    }
    if (row === undefined || (row.outcome !== 'ACCEPTED' && row.outcome !== 'CANCELLED')) throw unavailable();
    return { outcome: row.outcome, deletion: { status: deletionStatus(row.deletion_status), finalAt: instant(row.final_at) } };
  }

  async cancelDeletion(accessToken: string, body: unknown) {
    emptyBody(body);
    const row = await this.repository.cancelDeletion(accessToken).catch(() => {
      throw unavailable();
    });
    if (row === undefined || !['CANCELLED', 'NONE', 'NOT_CANCELLABLE'].includes(row.outcome)) throw unavailable();
    return { outcome: row.outcome, deletion: { status: deletionStatus(row.deletion_status), finalAt: instant(row.final_at) } };
  }

  /** The provider's password check on the caller's OWN Email: a proof token, or the refusal. Never anything else. */
  private async prove(accessToken: string, password: string, ip: string): Promise<string | 'PASSWORD_REJECTED'> {
    const owner = await this.provider.readOwnUser(accessToken, ip);
    if (owner === null) throw unavailable();
    const verdict = await this.provider.grant(owner.email, password, ip);
    if (verdict.kind === 'INVALID_CREDENTIALS') return 'PASSWORD_REJECTED';
    if (verdict.kind !== 'SESSION') throw unavailable();
    return verdict.accessToken;
  }

  private requireConfigured(clientIp: string | undefined): string {
    if (!this.provider.isConfigured() || typeof clientIp !== 'string' || clientIp === '') throw unavailable();
    return clientIp;
  }
}
