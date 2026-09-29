import { BadRequestException, Injectable } from '@nestjs/common';
import { isWellFormedLoginId } from './account.service';
import { LoginIdSignInRepository } from './login-id-sign-in.repository';
import { SupabasePasswordGrantService } from './supabase-password-grant.service';

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
 * ## Non-enumeration, by construction
 *
 * An unknown or malformed Login ID is NOT answered early. The exchange still spends a real password
 * grant, against a reserved `.invalid` address no account can hold, so an unknown Login ID and a known
 * one with a wrong password take the same path, the same upstream round trip, count against the same
 * rate limit, and meet the same answer (`INVALID_CREDENTIALS`). The only Email that ever leaves is the
 * one a reader who PROVED THE PASSWORD needs to verify their own unconfirmed address — the provider
 * checks the password before it says `email_not_confirmed` (W1B-01 record §4.3) — and a success returns
 * the tokens of the account the reader just proved they hold. Nothing here is logged.
 */
export type LoginIdSignInOutcome =
  | { readonly kind: 'SESSION'; readonly accessToken: string; readonly refreshToken: string }
  | { readonly kind: 'EMAIL_NOT_CONFIRMED'; readonly email: string }
  | { readonly kind: 'INVALID_CREDENTIALS' }
  | { readonly kind: 'UNAVAILABLE' };

/** A reserved-TLD address (RFC 2606) no account can receive mail at, spent for every unresolved Login ID. */
export const UNRESOLVED_LOGIN_ID_ADDRESS = 'no-account@login-id.invalid';
export const LOGIN_ID_SIGN_IN_MAX_LOGIN_ID = 64;
export const LOGIN_ID_SIGN_IN_MAX_PASSWORD = 1024;

@Injectable()
export class LoginIdSignInService {
  constructor(
    private readonly repository: LoginIdSignInRepository,
    private readonly passwordGrant: SupabasePasswordGrantService,
  ) {}

  async exchange(body: unknown, clientIp: string | undefined): Promise<LoginIdSignInOutcome> {
    const { loginId, password } = readBody(body);
    // Fail closed BEFORE any lookup: without a secret key the provider's per-reader rate limit cannot be
    // kept, and without the reader's address there is nothing to forward.
    if (!this.passwordGrant.isConfigured() || typeof clientIp !== 'string' || clientIp === '') return { kind: 'UNAVAILABLE' };

    let resolved: string | null = null;
    if (isWellFormedLoginId(loginId)) {
      try {
        resolved = await this.repository.signInAddressOf(loginId.toLowerCase());
      } catch {
        return { kind: 'UNAVAILABLE' };
      }
    }

    const verdict = await this.passwordGrant.grant(resolved ?? UNRESOLVED_LOGIN_ID_ADDRESS, password, clientIp);
    // Only a RESOLVED account can be answered with anything but a refusal. The reserved address cannot
    // hold a verified account, and even a provider that answered otherwise for it is refused here.
    if (resolved === null) return verdict.kind === 'UNAVAILABLE' ? verdict : { kind: 'INVALID_CREDENTIALS' };
    if (verdict.kind === 'EMAIL_NOT_CONFIRMED') return { kind: 'EMAIL_NOT_CONFIRMED', email: resolved };
    return verdict;
  }
}

/** Exactly `{ loginId, password }`, bounded. Anything else is a malformed request, answered generically. */
function readBody(body: unknown): { readonly loginId: string; readonly password: string } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException({ outcome: 'INVALID_REQUEST' });
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 2 || keys[0] !== 'loginId' || keys[1] !== 'password') throw new BadRequestException({ outcome: 'INVALID_REQUEST' });
  const { loginId, password } = record;
  if (typeof loginId !== 'string' || loginId.length === 0 || loginId.length > LOGIN_ID_SIGN_IN_MAX_LOGIN_ID) throw new BadRequestException({ outcome: 'INVALID_REQUEST' });
  if (typeof password !== 'string' || password.length === 0 || password.length > LOGIN_ID_SIGN_IN_MAX_PASSWORD) throw new BadRequestException({ outcome: 'INVALID_REQUEST' });
  return { loginId, password };
}
