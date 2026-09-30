import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
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
 */
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

const instant = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

@Injectable()
export class PrivacyDataService {
  constructor(
    private readonly repository: PrivacyDataRepository,
    private readonly provider: SupabasePasswordGrantService,
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
