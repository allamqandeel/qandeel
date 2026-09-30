import { Injectable } from '@nestjs/common';

export type ProviderRemovalVerdict = 'REMOVED' | 'UNAVAILABLE';

export const PROVIDER_REMOVAL_TIMEOUT_MS = 8000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * W3-MEGA-S — the provider half of a final Personal-world account deletion (W3-PDG-01 §8.2 "sessions end").
 *
 * It is reached ONLY by the server's deletion pass, and only for an account the database has already ERASED (the
 * account id comes from the database's own claim, never from a client). It removes the provider account itself:
 * Supabase Auth's hard delete destroys the user with its sessions and refresh tokens, so no device can refresh or sign
 * in again, and an access token still in flight is refused by the API's own guard, which asks the provider on every
 * request. Verified against the official Supabase Auth source (`adminUserDelete`: `tx.Destroy(user)` unless
 * `should_soft_delete`).
 *
 * The call uses the same server credential as the server's database channel, never a client token. It is kept apart
 * from the owner's relay on purpose: that file never reaches an administrative endpoint.
 *
 *   REMOVED      the provider confirmed it, or itself reported the account already gone (`user_not_found`: a retry
 *                after a lost answer);
 *   UNAVAILABLE  no usable answer: the pass keeps the request ERASED and asks again later. Nothing is logged.
 */
@Injectable()
export class ProviderAccountRemovalService {
  isConfigured(): boolean {
    return Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  async remove(userId: string): Promise<ProviderRemovalVerdict> {
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
    const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serverKey || !UUID.test(userId)) return 'UNAVAILABLE';
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { apikey: serverKey, Authorization: `Bearer ${serverKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ should_soft_delete: false }),
        signal: AbortSignal.timeout(PROVIDER_REMOVAL_TIMEOUT_MS),
      });
    } catch {
      return 'UNAVAILABLE';
    }
    if (response.status >= 200 && response.status < 300) return 'REMOVED';
    // Already gone counts only when the provider itself says so: a bare 404 could be a wrong address, and a deletion
    // must never be recorded complete while the provider account may still exist.
    if (response.status === 404) {
      const body = (await response.json().catch(() => null)) as { error_code?: unknown } | null;
      if (body !== null && typeof body === 'object' && body.error_code === 'user_not_found') return 'REMOVED';
    }
    return 'UNAVAILABLE';
  }
}
