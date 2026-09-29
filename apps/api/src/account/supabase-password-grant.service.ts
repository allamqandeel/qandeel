import { Injectable } from '@nestjs/common';

/**
 * W2-01 — the provider's OWN password check, asked from the server for a Login ID sign-in.
 *
 * QANDEEL never validates a password itself: Supabase Auth does, through its password grant
 * (`POST /auth/v1/token?grant_type=password`), exactly as it does when the device signs in with an
 * Email. What changes is only who asks — the QANDEEL API, because only the server may know which Email
 * a Login ID belongs to (P1 §3).
 *
 * ## The provider's abuse protection is kept, not replaced
 *
 * Supabase Auth rate-limits the password grant per client IP. A server-side caller would otherwise be
 * ONE IP for every reader, so the request carries the reader's own address in `Sb-Forwarded-For` and is
 * authorized with a Supabase SECRET key — the documented pairing (Supabase Auth rate-limit docs, "IP
 * address forwarding"): publishable and legacy `anon` / `service_role` keys are not honoured for it, and
 * the project must enable forwarding. Without a secret key this route FAILS CLOSED rather than falling
 * back to a shared bucket. That the project has forwarding enabled is external configuration recorded
 * in the W2-01 record, not something this code can observe.
 *
 * ## What leaves this class
 *
 * A typed verdict. The two tokens only on success, for the reader who proved the password; never the
 * provider's own words, never the Email, and nothing is logged.
 */
export type PasswordGrantVerdict =
  | { readonly kind: 'SESSION'; readonly accessToken: string; readonly refreshToken: string }
  /** The provider validated the password FIRST and then reported the Email unverified. */
  | { readonly kind: 'EMAIL_NOT_CONFIRMED' }
  | { readonly kind: 'INVALID_CREDENTIALS' }
  /** No usable answer: transport, a 5xx, a rate limit, or a server not configured for this route. */
  | { readonly kind: 'UNAVAILABLE' };

/** The API version whose errors carry a typed `error_code`, exactly as the installed auth client pins it. */
export const SUPABASE_AUTH_API_VERSION = '2024-01-01';
export const PASSWORD_GRANT_TIMEOUT_MS = 8000;

@Injectable()
export class SupabasePasswordGrantService {
  /** Whether this server can ask at all: a project URL and a SECRET key. Checked before any lookup. */
  isConfigured(): boolean {
    return Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SECRET_KEY);
  }

  async grant(email: string, password: string, clientIp: string): Promise<PasswordGrantVerdict> {
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!baseUrl || !secretKey) return { kind: 'UNAVAILABLE' };

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: secretKey,
          'Content-Type': 'application/json',
          'X-Supabase-Api-Version': SUPABASE_AUTH_API_VERSION,
          'Sb-Forwarded-For': clientIp,
        },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(PASSWORD_GRANT_TIMEOUT_MS),
      });
    } catch {
      return { kind: 'UNAVAILABLE' };
    }

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (response.ok) {
      const accessToken = body?.access_token;
      const refreshToken = body?.refresh_token;
      if (typeof accessToken === 'string' && accessToken !== '' && typeof refreshToken === 'string' && refreshToken !== '') {
        return { kind: 'SESSION', accessToken, refreshToken };
      }
      return { kind: 'UNAVAILABLE' };
    }
    const code = typeof body?.error_code === 'string' ? body.error_code : typeof body?.code === 'string' ? body.code : null;
    if (response.status === 400 && code === 'email_not_confirmed') return { kind: 'EMAIL_NOT_CONFIRMED' };
    // The provider's credential refusals. A rate limit (429) and every 5xx are NOT a verdict on the
    // credential, so they are unavailable rather than "wrong".
    if (response.status === 400 || response.status === 401 || response.status === 422) return { kind: 'INVALID_CREDENTIALS' };
    return { kind: 'UNAVAILABLE' };
  }
}
