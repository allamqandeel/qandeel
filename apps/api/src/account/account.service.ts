import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError, readDataApiUpstreamIdentity } from '../conversation/supabase-data-api.service';
import { AccountRepository, type AccountPublicIdRow } from './account.repository';

/**
 * P1 §2.1 leaves the Login ID grammar to implementation. W1B-01 fixes it, identically here, in the
 * database (migration 0123) and in the mobile sign-up: 3–30 characters of English letters and digits,
 * with `.` `-` `_` allowed only between letters and digits. Case-insensitive; stored lowercase.
 */
export const LOGIN_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
export const LOGIN_ID_MIN_LENGTH = 3;
export const LOGIN_ID_MAX_LENGTH = 30;

export function isWellFormedLoginId(value: string): boolean {
  const canonical = value.toLowerCase();
  return canonical.length >= LOGIN_ID_MIN_LENGTH && canonical.length <= LOGIN_ID_MAX_LENGTH && LOGIN_ID_PATTERN.test(canonical);
}

/**
 * What the Product needs to open the reader's first use and their Conversation, and nothing more.
 *
 *   displayName             — the account Name QANDEEL addresses them by (`{display_name}`), or null
 *                             when the account has none; no fallback is ever supplied.
 *   welcomePending          — the one-time first-use Welcome is still owed: a named account that has
 *                             neither completed it nor already conversed.
 *   firstConversationOpening — the First Conversation Opening, not the normal opener, is owed: the
 *                             account has never committed a turn. Its first committed turn consumes it.
 */
export interface AccountFirstUseView {
  readonly displayName: string | null;
  readonly welcomePending: boolean;
  readonly firstConversationOpening: boolean;
}

/**
 * W3-02 — the caller's own Public ID (P1 §6), as the database holds it: the canonical value, without the
 * `@` the Product shows in front of it, and whether the ONE lifetime manual change is still available.
 * Nothing else: no account id, Name, Login ID or Public runtime ref.
 */
export interface AccountPublicIdView {
  readonly publicId: string;
  readonly changeAvailable: boolean;
}

/**
 * The bounded outcomes of the one lifetime change (migration 0125 decides every one of them):
 *   CHANGED       committed — or the same command replayed after it committed;
 *   UNCHANGED     the requested value is the current Public ID; nothing was consumed;
 *   INVALID       not a well-formed Public ID; nothing was written;
 *   UNAVAILABLE   another account holds it; nothing about that account is known here;
 *   ALREADY_USED  the one change was already made by another command.
 */
export const PUBLIC_ID_CHANGE_OUTCOMES = Object.freeze(['CHANGED', 'UNCHANGED', 'INVALID', 'UNAVAILABLE', 'ALREADY_USED'] as const);
export type PublicIdChangeOutcome = (typeof PUBLIC_ID_CHANGE_OUTCOMES)[number];

export interface PublicIdChangeResult extends AccountPublicIdView {
  readonly outcome: PublicIdChangeOutcome;
}

/** A command identity: one UUID per logical change the reader confirms, reused only to retry it. */
const COMMAND_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** A bound on what is carried to the database; the grammar itself is the database's (0125). */
const PUBLIC_ID_REQUEST_MAX_LENGTH = 64;

function publicIdView(row: AccountPublicIdRow | undefined): AccountPublicIdView | null {
  if (row === undefined || row === null || typeof row !== 'object') return null;
  if (typeof row.current_public_id !== 'string' || row.current_public_id === '' || typeof row.change_available !== 'boolean') return null;
  return { publicId: row.current_public_id, changeAvailable: row.change_available };
}

@Injectable()
export class AccountService {
  constructor(private readonly repository: AccountRepository) {}

  async readFirstUse(accessToken: string): Promise<AccountFirstUseView> {
    let row;
    try {
      row = await this.repository.readFirstUse(accessToken);
    } catch {
      throw new ServiceUnavailableException('Account state is unavailable.');
    }
    if (row === undefined) throw new ServiceUnavailableException('Account state is unavailable.');
    const displayName = typeof row.name === 'string' && row.name !== '' ? row.name : null;
    return {
      displayName,
      welcomePending: displayName !== null && row.welcome_completed !== true && row.has_conversed !== true,
      firstConversationOpening: row.has_conversed !== true,
    };
  }

  async completeWelcome(accessToken: string): Promise<void> {
    try {
      await this.repository.completeWelcome(accessToken);
    } catch {
      throw new ServiceUnavailableException('Account state is unavailable.');
    }
  }

  /** The caller's own Public ID and allowance. An unreadable answer is unavailable, never a guess. */
  async readPublicId(accessToken: string): Promise<AccountPublicIdView> {
    let row;
    try {
      row = await this.repository.readPublicId(accessToken);
    } catch {
      throw new ServiceUnavailableException('Account state is unavailable.');
    }
    const view = publicIdView(row);
    if (view === null) throw new ServiceUnavailableException('Account state is unavailable.');
    return view;
  }

  /**
   * The caller's one lifetime Public ID change. The body is exactly `{ commandId, publicId }`: there is no
   * account field, because the caller is the token's. No availability is asked first — the database's
   * one transaction decides, so there is no Public-ID oracle beside the change itself.
   *
   * A command identity reused for a different value is a 409 and nothing else. Every other failure is
   * 503: the reader's client then re-reads the canonical state before offering a retry, because a lost
   * answer may hide a committed change.
   */
  async changePublicId(accessToken: string, body: unknown): Promise<PublicIdChangeResult> {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('A Public ID change is required.');
    const record = body as Record<string, unknown>;
    if (
      Object.keys(record).some((key) => key !== 'commandId' && key !== 'publicId') ||
      typeof record.commandId !== 'string' || !COMMAND_ID_PATTERN.test(record.commandId) ||
      typeof record.publicId !== 'string' || record.publicId.length > PUBLIC_ID_REQUEST_MAX_LENGTH
    ) {
      throw new BadRequestException('A Public ID change is required.');
    }
    let row;
    try {
      row = await this.repository.changePublicId(accessToken, record.commandId.toLowerCase(), record.publicId);
    } catch (error) {
      if (error instanceof DataApiError) {
        const identity = readDataApiUpstreamIdentity(error);
        if (identity.databaseCode === '23505' && identity.databaseMessage === 'PUBLIC_ID_COMMAND_CONFLICT') {
          throw new ConflictException('This change command was already used for another Public ID.');
        }
      }
      throw new ServiceUnavailableException('Account state is unavailable.');
    }
    const view = publicIdView(row);
    const outcome = row?.outcome;
    if (view === null || !PUBLIC_ID_CHANGE_OUTCOMES.includes(outcome as PublicIdChangeOutcome)) {
      throw new ServiceUnavailableException('Account state is unavailable.');
    }
    return { outcome: outcome as PublicIdChangeOutcome, ...view };
  }

  /**
   * The one pre-authentication question. It answers a boolean and nothing else: never an account,
   * an Email or an id. A malformed Login ID is simply not available, without asking the database.
   */
  async checkLoginIdAvailability(body: unknown): Promise<{ readonly available: boolean }> {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('A Login ID is required.');
    const record = body as Record<string, unknown>;
    if (Object.keys(record).some((key) => key !== 'loginId') || typeof record.loginId !== 'string' || record.loginId.length > 64) {
      throw new BadRequestException('A Login ID is required.');
    }
    if (!isWellFormedLoginId(record.loginId)) return { available: false };
    try {
      return { available: await this.repository.isLoginIdAvailable(record.loginId.toLowerCase()) };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Login ID availability is unavailable.');
    }
  }
}
