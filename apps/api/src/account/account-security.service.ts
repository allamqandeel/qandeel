import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { AccountIdentityRepository } from './account-identity.repository';
import { SupabasePasswordGrantService } from './supabase-password-grant.service';

/**
 * W3-MEGA-A — Account & Identity Completion + Security v1, the server side.
 *
 * Every route acts for the CALLER only: the account is the verified token's, and no body carries an account, a user
 * or any other identifier as authority. Every provider call is the owner's own (their token, or a proof token their
 * own password just earned), made through the one relay file. Nothing is logged, and no provider word is returned.
 *
 * ## Reauthentication — reused, not invented
 *
 * W3-PDG-01 §2 froze current-password re-entry as the first step of changing an identifier. The mechanism already
 * exists: W2-01's server relay spends a password on the provider's OWN password grant. Here it is spent on the
 * caller's own Email, so it proves the caller knows their password; the proof session it creates is ended at once.
 * For the Login ID the database demands the proof itself (0129): the change runs on the proof token.
 *
 * ## What each answer means
 *
 *   PASSWORD_REJECTED  the provider refused the password the owner re-entered;
 *   INVALID / INVALID_EMAIL / POLICY  the value itself cannot be used;
 *   UNAVAILABLE (Login ID only)  another account holds it — nobody is named;
 *   CHANGED            committed; CHANGED_SIGNED_OUT when the provider required the change on a fresh session, so the
 *                      current device's session ended too;
 *   503                no usable answer: the client never guesses, it re-reads or offers the same retry.
 */
export const NAME_CHANGE_OUTCOMES = Object.freeze(['CHANGED', 'UNCHANGED', 'INVALID'] as const);
export const LOGIN_ID_CHANGE_OUTCOMES = Object.freeze(['CHANGED', 'UNCHANGED', 'INVALID', 'UNAVAILABLE'] as const);

export interface AccountIdentityView {
  readonly name: string | null;
  readonly loginId: string | null;
  readonly email: string;
  readonly emailVerified: boolean;
}

const COMMAND_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const EMAIL_CODE = /^[0-9]{6}$/u;
/** Plausible as an address; the provider decides the rest. */
const PLAUSIBLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
export const ACCOUNT_SECURITY_MAX_PASSWORD = 1024;
const MAX_NAME = 200;
const MAX_LOGIN_ID = 64;
const MAX_EMAIL = 254;

const unavailable = () => new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
const invalid = () => new BadRequestException({ outcome: 'INVALID_REQUEST' });

/** Exactly these keys, each a string within its bound; anything else — an account field included — is refused. */
function exactStrings(body: unknown, bounds: Readonly<Record<string, number>>): Record<string, string> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const record = body as Record<string, unknown>;
  const keys = Object.keys(bounds);
  if (Object.keys(record).length !== keys.length || Object.keys(record).some((key) => !keys.includes(key))) throw invalid();
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== 'string' || value.length > bounds[key]) throw invalid();
  }
  return record as Record<string, string>;
}

@Injectable()
export class AccountSecurityService {
  constructor(
    private readonly repository: AccountIdentityRepository,
    private readonly provider: SupabasePasswordGrantService,
  ) {}

  /** The owner's Name, Login ID and Email with its status. An unreadable part is unavailable, never a guess. */
  async readIdentity(accessToken: string, clientIp: string | undefined): Promise<AccountIdentityView> {
    const ip = this.requireConfigured(clientIp);
    const [row, owner] = await Promise.all([
      this.repository.readIdentity(accessToken).catch(() => undefined),
      this.provider.readOwnUser(accessToken, ip),
    ]);
    if (row === undefined || row === null || owner === null) throw unavailable();
    const name = typeof row.name === 'string' && row.name !== '' ? row.name : null;
    const loginId = typeof row.login_id === 'string' && row.login_id !== '' ? row.login_id : null;
    return { name, loginId, email: owner.email, emailVerified: owner.emailVerified };
  }

  /** The owner's Name (P1 §2.3). Setting a value is idempotent; a lost answer is reconciled by reading. */
  async changeName(accessToken: string, body: unknown): Promise<{ readonly outcome: (typeof NAME_CHANGE_OUTCOMES)[number]; readonly name: string | null }> {
    const { name } = exactStrings(body, { name: MAX_NAME });
    let row;
    try {
      row = await this.repository.changeName(accessToken, name);
    } catch {
      throw unavailable();
    }
    const outcome = row?.outcome as (typeof NAME_CHANGE_OUTCOMES)[number];
    if (row === undefined || !NAME_CHANGE_OUTCOMES.includes(outcome) || (row.current_name !== null && typeof row.current_name !== 'string')) throw unavailable();
    return { outcome, name: row.current_name };
  }

  /**
   * The owner's Login ID (P1 §2.1), after the owner re-enters the password. The body is exactly
   * `{ commandId, loginId, password }`. A command identity reused for another value is 409.
   */
  async changeLoginId(accessToken: string, body: unknown, clientIp: string | undefined) {
    const { commandId, loginId, password } = exactStrings(body, { commandId: 36, loginId: MAX_LOGIN_ID, password: ACCOUNT_SECURITY_MAX_PASSWORD });
    if (!COMMAND_ID_PATTERN.test(commandId) || password === '') throw invalid();
    const ip = this.requireConfigured(clientIp);
    const proof = await this.prove(accessToken, password, ip);
    if (proof === 'PASSWORD_REJECTED') return { outcome: 'PASSWORD_REJECTED' as const };
    try {
      let row;
      try {
        row = await this.repository.changeLoginId(proof, commandId.toLowerCase(), loginId);
      } catch (error) {
        if (error instanceof DataApiError && error.status === 409) throw new ConflictException({ outcome: 'COMMAND_CONFLICT' });
        throw unavailable();
      }
      const outcome = row?.outcome as (typeof LOGIN_ID_CHANGE_OUTCOMES)[number];
      if (row === undefined || !LOGIN_ID_CHANGE_OUTCOMES.includes(outcome) || typeof row.current_login_id !== 'string') throw unavailable();
      return { outcome, loginId: row.current_login_id };
    } finally {
      await this.provider.endSessions(proof, 'local', ip);
    }
  }

  /**
   * Start the owner's Email change (W3-PDG-01 §2 steps 1–4): the password, then the new Email. Non-enumerating: an
   * address another account holds answers exactly like a free one (ACCEPTED), and nothing changes yet.
   */
  async requestEmailChange(accessToken: string, body: unknown, clientIp: string | undefined) {
    const { password, email } = exactStrings(body, { password: ACCOUNT_SECURITY_MAX_PASSWORD, email: MAX_EMAIL });
    if (password === '') throw invalid();
    const requested = email.trim();
    if (!PLAUSIBLE_EMAIL.test(requested)) return { outcome: 'INVALID_EMAIL' as const };
    const ip = this.requireConfigured(clientIp);
    const owner = await this.provider.readOwnUser(accessToken, ip);
    if (owner === null) throw unavailable();
    const proof = await this.prove(accessToken, password, ip, owner.email);
    if (proof === 'PASSWORD_REJECTED') return { outcome: 'PASSWORD_REJECTED' as const };
    await this.provider.endSessions(proof, 'local', ip);
    if (requested.toLowerCase() === owner.email.toLowerCase()) return { outcome: 'UNCHANGED' as const };
    const verdict = await this.provider.requestEmailChange(accessToken, requested, ip);
    if (verdict.kind === 'UNAVAILABLE') throw unavailable();
    return { outcome: verdict.kind === 'INVALID_EMAIL' ? ('INVALID_EMAIL' as const) : ('ACCEPTED' as const) };
  }

  /**
   * Finish the owner's Email change (W3-PDG-01 §2 steps 4–8): the code sent to the CURRENT Email first, then the code
   * sent to the new one. The current-Email confirmation goes first on purpose: a project without "Secure email
   * change" has no such code, so the change can never complete on the new Email alone. The Email changes only when
   * the provider has accepted both; then the provider's new session and the caller's own session are ended, and the
   * reader returns to Sign in. A wrong, expired or never-sent code (including for an address another account holds)
   * is ONE answer: CODE_REJECTED.
   */
  async confirmEmailChange(accessToken: string, body: unknown, clientIp: string | undefined) {
    const { email, newEmailCode, currentEmailCode } = exactStrings(body, { email: MAX_EMAIL, newEmailCode: 6, currentEmailCode: 6 });
    if (!EMAIL_CODE.test(newEmailCode) || !EMAIL_CODE.test(currentEmailCode)) throw invalid();
    const requested = email.trim();
    const ip = this.requireConfigured(clientIp);
    const owner = await this.provider.readOwnUser(accessToken, ip);
    if (owner === null) throw unavailable();
    // Already committed (a lost answer, retried): the canonical Email is the new one.
    if (owner.email.toLowerCase() === requested.toLowerCase()) return this.finishEmailChange(accessToken, null, ip);

    const current = await this.provider.verifyEmailChangeCode(owner.email, currentEmailCode, ip);
    if (current.kind === 'UNAVAILABLE') throw unavailable();
    if (current.kind === 'CODE_REJECTED') return { outcome: 'CODE_REJECTED' as const };
    if (current.kind === 'SESSION') return this.finishEmailChange(accessToken, current.accessToken, ip);

    const next = await this.provider.verifyEmailChangeCode(requested, newEmailCode, ip);
    if (next.kind === 'CODE_REJECTED') return { outcome: 'CODE_REJECTED' as const };
    if (next.kind !== 'SESSION') throw unavailable();
    return this.finishEmailChange(accessToken, next.accessToken, ip);
  }

  /**
   * Change the owner's password (W3-PDG-01 §3): the current password, then the new one. The provider ends every OTHER
   * session of the account as it changes the password; the current device continues. When the project requires a
   * fresh session for a password change, the change is made on the proof session instead — then the current
   * device's session ends too, and the answer says so (CHANGED_SIGNED_OUT).
   */
  async changePassword(accessToken: string, body: unknown, clientIp: string | undefined) {
    const { password, newPassword } = exactStrings(body, { password: ACCOUNT_SECURITY_MAX_PASSWORD, newPassword: ACCOUNT_SECURITY_MAX_PASSWORD });
    if (password === '' || newPassword === '') throw invalid();
    const ip = this.requireConfigured(clientIp);
    const proof = await this.prove(accessToken, password, ip);
    if (proof === 'PASSWORD_REJECTED') return { outcome: 'PASSWORD_REJECTED' as const };
    let verdict = await this.provider.changePassword(accessToken, newPassword, password, ip);
    let signedOut = false;
    if (verdict.kind === 'REAUTHENTICATION_NEEDED') {
      verdict = await this.provider.changePassword(proof, newPassword, password, ip);
      signedOut = verdict.kind === 'CHANGED';
    }
    await this.provider.endSessions(proof, 'local', ip);
    if (verdict.kind === 'POLICY') return { outcome: 'POLICY' as const };
    if (verdict.kind !== 'CHANGED') throw unavailable();
    if (signedOut) {
      await this.provider.endSessions(accessToken, 'local', ip);
      return { outcome: 'CHANGED_SIGNED_OUT' as const };
    }
    // The provider already ended the others with the change; asking again only makes it explicit.
    await this.provider.endSessions(accessToken, 'others', ip);
    return { outcome: 'CHANGED' as const };
  }

  /** Sign out from other devices (W3-PDG-01 §3): every OTHER session of the account, never this one. */
  async signOutOtherDevices(accessToken: string, clientIp: string | undefined) {
    const ip = this.requireConfigured(clientIp);
    if (!(await this.provider.endSessions(accessToken, 'others', ip))) throw unavailable();
    return { outcome: 'SIGNED_OUT_OTHERS' as const };
  }

  private async finishEmailChange(accessToken: string, providerSession: string | null, ip: string) {
    if (providerSession !== null) await this.provider.endSessions(providerSession, 'local', ip);
    await this.provider.endSessions(accessToken, 'local', ip);
    return { outcome: 'CHANGED' as const };
  }

  /** The routes need the relay (secret key) and the reader's address; without either they fail closed. */
  private requireConfigured(clientIp: string | undefined): string {
    if (!this.provider.isConfigured() || typeof clientIp !== 'string' || clientIp === '') throw unavailable();
    return clientIp;
  }

  /**
   * The provider's own password check, for the CALLER's own Email: the proof token, or PASSWORD_REJECTED. Any other
   * provider answer is unavailable (a signed-in owner's Email is verified, so EMAIL_NOT_CONFIRMED is not a verdict).
   */
  private async prove(accessToken: string, password: string, ip: string, knownEmail?: string): Promise<string | 'PASSWORD_REJECTED'> {
    const email = knownEmail ?? (await this.provider.readOwnUser(accessToken, ip))?.email;
    if (email === undefined) throw unavailable();
    const verdict = await this.provider.grant(email, password, ip);
    if (verdict.kind === 'INVALID_CREDENTIALS') return 'PASSWORD_REJECTED';
    if (verdict.kind !== 'SESSION') throw unavailable();
    return verdict.accessToken;
  }
}
