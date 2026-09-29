import { BadRequestException, Injectable } from '@nestjs/common';
import { isWellFormedLoginId } from './account.service';
import { LoginIdSignInRepository } from './login-id-sign-in.repository';
import { SupabasePasswordGrantService, type EmailCodeVerdict, type PasswordGrantVerdict, type ResendVerdict } from './supabase-password-grant.service';

/**
 * W2-01 (E2E-A-07) — sign in with a Login ID, without ANY client learning which Email it belongs to.
 *
 * P1 §3: one identifier input accepts `Login ID OR Email`; failure wording is generic and reveals
 * neither which identifier exists nor whether it does; there is no client-visible Login-ID → Email
 * directory. The device signs in with an Email directly against Supabase Auth, as T-14 always did. A
 * Login ID comes here, and this exchange is the whole of the difference:
 *
 *   1. resolve the Login ID to its account's Email on the server channel (migration 0124);
 *   2. hand that Email and the reader's password to the provider's OWN password grant — QANDEEL never
 *      checks a password — with the reader's address forwarded so the provider's per-IP rate limit
 *      still applies to them (`SupabasePasswordGrantService`);
 *   3. answer the provider's verdict and nothing else.
 *
 * ## A client never learns which Email belongs to a Login ID — including after password proof
 *
 * W2-01 R1 (Product Owner clarification): the rule is unconditional. A reader who proved the password of
 * an account whose Email is unverified is told `EMAIL_NOT_CONFIRMED` and nothing more, and verifies that
 * Email through two more exchanges here (`verifyEmail`, `resendVerification`) that take the Login ID the
 * reader typed and resolve it again on this side. The Email is used for exactly one provider request each
 * time and never leaves: no response, no masked hint, no account id, and nothing is logged.
 *
 * ## Non-enumeration, by construction
 *
 * An unknown or malformed Login ID is NOT answered early. Every exchange still spends a real provider
 * request, against a reserved `.invalid` address no account can hold, so an unknown Login ID and a known
 * one take the same path, the same upstream round trip, count against the same rate limit, and meet the
 * same answer: `INVALID_CREDENTIALS` for a sign-in, `CODE_REJECTED` for a code, `ACCEPTED` for a resend.
 */
export type LoginIdSignInOutcome =
  | { readonly kind: 'SESSION'; readonly accessToken: string; readonly refreshToken: string }
  | { readonly kind: 'EMAIL_NOT_CONFIRMED' }
  | { readonly kind: 'INVALID_CREDENTIALS' }
  | { readonly kind: 'UNAVAILABLE' };

export type LoginIdEmailCodeOutcome = EmailCodeVerdict;
export type LoginIdResendOutcome = ResendVerdict;

/** A reserved-TLD address (RFC 2606) no account can receive mail at, spent for every unresolved Login ID. */
export const UNRESOLVED_LOGIN_ID_ADDRESS = 'no-account@login-id.invalid';
export const LOGIN_ID_SIGN_IN_MAX_LOGIN_ID = 64;
export const LOGIN_ID_SIGN_IN_MAX_PASSWORD = 1024;
/** The provider's sign-up code: six digits, exactly as the device's Verify Email accepts it. */
const EMAIL_CODE = /^[0-9]{6}$/u;

type Resolution = { readonly kind: 'RESOLVED'; readonly email: string } | { readonly kind: 'UNRESOLVED' } | { readonly kind: 'UNAVAILABLE' };

@Injectable()
export class LoginIdSignInService {
  constructor(
    private readonly repository: LoginIdSignInRepository,
    private readonly passwordGrant: SupabasePasswordGrantService,
  ) {}

  async exchange(body: unknown, clientIp: string | undefined): Promise<LoginIdSignInOutcome> {
    const { loginId, password } = readBody(body, ['loginId', 'password'], { password: isBoundedPassword });
    const resolution = await this.resolve(loginId, clientIp);
    if (resolution.kind === 'UNAVAILABLE') return { kind: 'UNAVAILABLE' };

    const verdict: PasswordGrantVerdict = await this.passwordGrant.grant(addressOf(resolution), password, clientIp as string);
    // Only a RESOLVED account can be answered with anything but a refusal. The reserved address cannot
    // hold a verified account, and even a provider that answered otherwise for it is refused here.
    if (resolution.kind === 'UNRESOLVED') return verdict.kind === 'UNAVAILABLE' ? verdict : { kind: 'INVALID_CREDENTIALS' };
    // The resolved Email stays here: the reader is told only that verification is required.
    if (verdict.kind === 'EMAIL_NOT_CONFIRMED') return { kind: 'EMAIL_NOT_CONFIRMED' };
    return verdict;
  }

  /** W2-01 R1 — verify the Login-ID-origin sign-up code. A session only for the reader who holds the code. */
  async verifyEmail(body: unknown, clientIp: string | undefined): Promise<LoginIdEmailCodeOutcome> {
    const { loginId, code } = readBody(body, ['code', 'loginId'], { code: (value) => EMAIL_CODE.test(value) });
    const resolution = await this.resolve(loginId, clientIp);
    if (resolution.kind === 'UNAVAILABLE') return { kind: 'UNAVAILABLE' };
    const verdict = await this.passwordGrant.verifyEmailCode(addressOf(resolution), code, clientIp as string);
    if (resolution.kind === 'UNRESOLVED') return verdict.kind === 'UNAVAILABLE' ? verdict : { kind: 'CODE_REJECTED' };
    return verdict;
  }

  /** W2-01 R1 — ask for a new Login-ID-origin sign-up code. One answer for every Login ID. */
  async resendVerification(body: unknown, clientIp: string | undefined): Promise<LoginIdResendOutcome> {
    const { loginId } = readBody(body, ['loginId'], {});
    const resolution = await this.resolve(loginId, clientIp);
    if (resolution.kind === 'UNAVAILABLE') return { kind: 'UNAVAILABLE' };
    return this.passwordGrant.resendEmailCode(addressOf(resolution), clientIp as string);
  }

  /**
   * The Login ID's Email, on the server channel only. Fails closed BEFORE any lookup: without a secret
   * key the provider's per-reader rate limit cannot be kept, and without the reader's address there is
   * nothing to forward. A malformed Login ID is simply unresolved — never answered early.
   */
  private async resolve(loginId: string, clientIp: string | undefined): Promise<Resolution> {
    if (!this.passwordGrant.isConfigured() || typeof clientIp !== 'string' || clientIp === '') return { kind: 'UNAVAILABLE' };
    if (!isWellFormedLoginId(loginId)) return { kind: 'UNRESOLVED' };
    try {
      const email = await this.repository.signInAddressOf(loginId.toLowerCase());
      return email === null ? { kind: 'UNRESOLVED' } : { kind: 'RESOLVED', email };
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
  }
}

function addressOf(resolution: Exclude<Resolution, { kind: 'UNAVAILABLE' }>): string {
  return resolution.kind === 'RESOLVED' ? resolution.email : UNRESOLVED_LOGIN_ID_ADDRESS;
}

function isBoundedPassword(value: string): boolean {
  return value.length <= LOGIN_ID_SIGN_IN_MAX_PASSWORD;
}

/**
 * Exactly the named keys (sorted), each a non-empty string; the Login ID bounded, and every other field
 * passing its own check. Anything else is a malformed request, answered generically.
 */
function readBody<K extends string>(body: unknown, keys: readonly K[], checks: Partial<Record<K, (value: string) => boolean>>): Record<K, string> & { readonly loginId: string } {
  const invalid = () => new BadRequestException({ outcome: 'INVALID_REQUEST' });
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const record = body as Record<string, unknown>;
  const present = Object.keys(record).sort();
  if (present.length !== keys.length || present.some((key, index) => key !== keys[index])) throw invalid();
  const read = {} as Record<K, string>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== 'string' || value.length === 0) throw invalid();
    const check = checks[key];
    if (check !== undefined && !check(value)) throw invalid();
    read[key] = value;
  }
  const loginId = record.loginId;
  if (typeof loginId !== 'string' || loginId.length > LOGIN_ID_SIGN_IN_MAX_LOGIN_ID) throw invalid();
  return read as Record<K, string> & { readonly loginId: string };
}
