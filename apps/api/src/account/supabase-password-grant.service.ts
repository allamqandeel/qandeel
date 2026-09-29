import { Injectable } from '@nestjs/common';

/**
 * W2-01 — the provider's OWN password check, asked from the server for a Login ID sign-in.
 *
 * QANDEEL never validates a password itself: Supabase Auth does, through its password grant
 * (`POST /auth/v1/token?grant_type=password`), exactly as it does when the device signs in with an
 * Email. What changes is only who asks — the QANDEEL API, because only the server may know which Email
 * a Login ID belongs to (P1 §3).
 *
 * W2-01 R1 — the same reason makes this the server's ask for the Login-ID-origin Email verification too.
 * A reader who signed in by Login ID and whose Email is unverified must verify it WITHOUT learning it, so
 * the 6-digit code is checked by the provider's own `POST /auth/v1/verify` and a new code is asked from
 * its own `POST /auth/v1/resend`, both with the Email the server resolved. QANDEEL checks no code either.
 *
 * ## The provider's abuse protection is kept, not replaced
 *
 * Supabase Auth rate-limits these endpoints per client IP. A server-side caller would otherwise be
 * ONE IP for every reader, so each request carries the reader's own address in `Sb-Forwarded-For` and is
 * authorized with a Supabase SECRET key — the documented pairing (Supabase Auth rate-limit docs, "IP
 * address forwarding"): publishable and legacy `anon` / `service_role` keys are not honoured for it, and
 * the project must enable forwarding. Without a secret key these routes FAIL CLOSED rather than falling
 * back to a shared bucket. That the project has forwarding enabled is external configuration recorded
 * in the W2-01 record, not something this code can observe.
 *
 * ## What leaves this class
 *
 * A typed verdict. The two tokens only on success, for the reader who proved the password or the code;
 * never the provider's own words, never the Email, and nothing is logged.
 */
export type PasswordGrantVerdict =
  | { readonly kind: 'SESSION'; readonly accessToken: string; readonly refreshToken: string }
  /** The provider validated the password FIRST and then reported the Email unverified. */
  | { readonly kind: 'EMAIL_NOT_CONFIRMED' }
  | { readonly kind: 'INVALID_CREDENTIALS' }
  /** No usable answer: transport, a 5xx, a rate limit, or a server not configured for this route. */
  | { readonly kind: 'UNAVAILABLE' };

/** W2-01 R1 — the provider's verdict on a sign-up verification code. A wrong and an expired code are one answer. */
export type EmailCodeVerdict =
  | { readonly kind: 'SESSION'; readonly accessToken: string; readonly refreshToken: string }
  | { readonly kind: 'CODE_REJECTED' }
  | { readonly kind: 'UNAVAILABLE' };

/**
 * W2-01 R1 — a resend is answered by WHETHER the provider answered, never by what it said: sent, no such
 * account, already verified, rate-limited for that account, a mail failure for that account — each could
 * differ between a Login ID that resolves and one that does not.
 */
export type ResendVerdict = { readonly kind: 'ACCEPTED' } | { readonly kind: 'UNAVAILABLE' };

/** The API version whose errors carry a typed `error_code`, exactly as the installed auth client pins it. */
export const SUPABASE_AUTH_API_VERSION = '2024-01-01';
export const PASSWORD_GRANT_TIMEOUT_MS = 8000;

type ProviderAnswer = { readonly status: number; readonly body: Record<string, unknown> | null } | null;

@Injectable()
export class SupabasePasswordGrantService {
  /** Whether this server can ask at all: a project URL and a SECRET key. Checked before any lookup. */
  isConfigured(): boolean {
    return Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SECRET_KEY);
  }

  async grant(email: string, password: string, clientIp: string): Promise<PasswordGrantVerdict> {
    const answer = await this.ask('/auth/v1/token?grant_type=password', { email, password }, clientIp);
    if (answer === null) return { kind: 'UNAVAILABLE' };
    const session = sessionOf(answer);
    if (session !== null) return session;
    if (answer.status >= 200 && answer.status < 300) return { kind: 'UNAVAILABLE' };
    if (answer.status === 400 && errorCodeOf(answer.body) === 'email_not_confirmed') return { kind: 'EMAIL_NOT_CONFIRMED' };
    // The provider's credential refusals. A rate limit (429) and every 5xx are NOT a verdict on the
    // credential, so they are unavailable rather than "wrong".
    if (answer.status === 400 || answer.status === 401 || answer.status === 422) return { kind: 'INVALID_CREDENTIALS' };
    return { kind: 'UNAVAILABLE' };
  }

  /** W2-01 R1 — verify a sign-up code for the resolved Email, exactly as the device's `verifyOtp({ type: 'email' })` asks. */
  async verifyEmailCode(email: string, code: string, clientIp: string): Promise<EmailCodeVerdict> {
    const answer = await this.ask('/auth/v1/verify', { type: 'email', email, token: code }, clientIp);
    if (answer === null) return { kind: 'UNAVAILABLE' };
    const session = sessionOf(answer);
    if (session !== null) return session;
    // The provider's refusals of the code (`otp_expired` covers a wrong and an expired one alike). A rate
    // limit and every 5xx say nothing about the code.
    if (answer.status >= 400 && answer.status < 500 && answer.status !== 429) return { kind: 'CODE_REJECTED' };
    return { kind: 'UNAVAILABLE' };
  }

  /** W2-01 R1 — ask for a new sign-up code for the resolved Email, exactly as the device's `resend({ type: 'signup' })` asks. */
  async resendEmailCode(email: string, clientIp: string): Promise<ResendVerdict> {
    const answer = await this.ask('/auth/v1/resend', { type: 'signup', email }, clientIp);
    // Non-enumerating: ONLY a request that produced no HTTP answer is unavailable.
    return answer === null ? { kind: 'UNAVAILABLE' } : { kind: 'ACCEPTED' };
  }

  /** One provider request. `null` when this server cannot ask or no HTTP answer came back. Nothing is logged. */
  private async ask(path: string, payload: Record<string, string>, clientIp: string): Promise<ProviderAnswer> {
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!baseUrl || !secretKey) return null;

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          apikey: secretKey,
          'Content-Type': 'application/json',
          'X-Supabase-Api-Version': SUPABASE_AUTH_API_VERSION,
          'Sb-Forwarded-For': clientIp,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(PASSWORD_GRANT_TIMEOUT_MS),
      });
    } catch {
      return null;
    }
    const body = (await response.json().catch(() => null)) as unknown;
    return { status: response.status, body: body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null };
  }
}

/** The two tokens of a successful answer, or null. A 2xx without both is not a session. */
function sessionOf(answer: NonNullable<ProviderAnswer>): { readonly kind: 'SESSION'; readonly accessToken: string; readonly refreshToken: string } | null {
  if (answer.status < 200 || answer.status >= 300) return null;
  const accessToken = answer.body?.access_token;
  const refreshToken = answer.body?.refresh_token;
  if (typeof accessToken === 'string' && accessToken !== '' && typeof refreshToken === 'string' && refreshToken !== '') {
    return { kind: 'SESSION', accessToken, refreshToken };
  }
  return null;
}

function errorCodeOf(body: Record<string, unknown> | null): string | null {
  return typeof body?.error_code === 'string' ? body.error_code : typeof body?.code === 'string' ? body.code : null;
}
