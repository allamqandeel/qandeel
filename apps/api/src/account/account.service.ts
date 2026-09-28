import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AccountRepository } from './account.repository';

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
