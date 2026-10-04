/**
 * A3-02 — the client for the device side of platform delivery.
 *
 *   PUT  /push/device                 — register / refresh / rotate THIS installation (token, OS permission, zone, locale)
 *   POST /push/device/detach          — sign-out: this installation stops receiving and forgets its token
 *   POST /push/device/detach-others   — "sign out from other devices": every other installation stops receiving
 *   POST /push/opened                 — per-device evidence: this installation's notification was tapped
 *
 * A transport and nothing else, exactly like the Activity client: no credential of its own (the request-time seam its
 * caller hands it), no user id, no retry, no meaning. Every answer is one outcome word, decoded strictly. A notification
 * tap's Direct Entry is NOT here: it is Activity's `open`, the ONE revalidation boundary (D38).
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

export type PushPlatform = 'ANDROID' | 'IOS';
export type OsPermission = 'GRANTED' | 'DENIED' | 'NOT_REQUESTED';

export interface PushDeviceSync {
  readonly installationId: string;
  readonly platform: PushPlatform;
  /** The platform's own device token (FCM / APNs), or null when none is held. Never logged, never shown. */
  readonly pushToken: string | null;
  readonly apnsEnvironment: 'PRODUCTION' | 'SANDBOX' | null;
  readonly osPermission: OsPermission;
  readonly timeZone: string;
  readonly locale: 'ar' | 'en';
  readonly appVersion: string | null;
}

export interface PushApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const SYNC = new Set(['REGISTERED', 'UPDATED', 'ROTATED', 'REATTACHED']);

export class PushApiClient {
  constructor(private readonly config: PushApiConfig) {}

  async sync(input: PushDeviceSync): Promise<boolean> {
    return SYNC.has((await this.outcome('PUT', '/push/device', input)) ?? '');
  }

  async detach(installationId: string): Promise<boolean> {
    const outcome = await this.outcome('POST', '/push/device/detach', { installationId });
    return outcome === 'DETACHED' || outcome === 'NOT_ATTACHED';
  }

  async detachOthers(installationId: string): Promise<boolean> {
    return (await this.outcome('POST', '/push/device/detach-others', { installationId })) === 'DETACHED';
  }

  async recordOpened(installationId: string, itemId: string): Promise<boolean> {
    const outcome = await this.outcome('POST', '/push/opened', { installationId, itemId });
    return outcome === 'RECORDED' || outcome === 'NO_EVIDENCE';
  }

  private async outcome(method: string, path: string, payload: unknown): Promise<string | null> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method, headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as unknown;
      if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
      const keys = Object.keys(body);
      const outcome = (body as { outcome?: unknown }).outcome;
      return keys.length === 1 && typeof outcome === 'string' ? outcome : null;
    } catch {
      return null;
    }
  }
}
