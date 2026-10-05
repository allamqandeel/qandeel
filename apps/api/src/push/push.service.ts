import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { validTimeZone } from '../activity/activity.service';
import { PushRepository } from './push.repository';
import { OS_PERMISSIONS, PUSH_PLATFORMS, type OsPermission, type PushPlatform } from './push.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const VERSION = /^[0-9A-Za-z.+_-]{1,32}$/u;

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[], required: readonly string[] = allowed) => {
  if (Object.keys(value).some((key) => !allowed.includes(key)) || required.some((key) => !(key in value))) invalid();
};
const installation = (value: unknown): string => (typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : invalid());

export type SyncOutcome = 'REGISTERED' | 'UPDATED' | 'ROTATED' | 'REATTACHED';

/**
 * A3-02 — the owner-only device boundary (migration 0137). Identity is the verified token only; no route takes a user id,
 * and no answer ever carries a token, another device or an attempt. Every answer is one outcome word.
 *
 * The token arrives here only to be stored on the server channel's side of the boundary; it is never logged (nothing in
 * this module logs) and never echoed.
 */
@Injectable()
export class PushService {
  constructor(private readonly repository: PushRepository) {}

  async sync(token: string, body: unknown): Promise<{ readonly outcome: SyncOutcome }> {
    const value = record(body);
    exactKeys(value, ['installationId', 'platform', 'pushToken', 'apnsEnvironment', 'osPermission', 'timeZone', 'locale', 'appVersion']);
    const platform = (PUSH_PLATFORMS as readonly string[]).includes(value.platform as string) ? value.platform as PushPlatform : invalid();
    const permission = (OS_PERMISSIONS as readonly string[]).includes(value.osPermission as string) ? value.osPermission as OsPermission : invalid();
    const pushToken = value.pushToken === null ? null
      : typeof value.pushToken === 'string' && value.pushToken.length >= 1 && value.pushToken.length <= 4096 && !/\s/u.test(value.pushToken) ? value.pushToken : invalid();
    const environment = platform === 'IOS'
      ? (value.apnsEnvironment === 'PRODUCTION' || value.apnsEnvironment === 'SANDBOX' ? value.apnsEnvironment : invalid())
      : (value.apnsEnvironment === null ? null : invalid());
    const timeZone = validTimeZone(value.timeZone) ?? invalid();
    const locale = value.locale === 'ar' || value.locale === 'en' ? value.locale : invalid();
    const appVersion = value.appVersion === null ? null : typeof value.appVersion === 'string' && VERSION.test(value.appVersion) ? value.appVersion : invalid();
    return this.guard(async () => {
      const rows = await this.repository.sync(token, {
        p_installation_id: installation(value.installationId), p_platform: platform, p_token: pushToken,
        p_apns_environment: environment, p_os_permission: permission, p_time_zone: timeZone, p_locale: locale, p_app_version: appVersion,
      });
      const outcome = Array.isArray(rows) && rows.length === 1 ? rows[0].outcome : null;
      if (outcome !== 'REGISTERED' && outcome !== 'UPDATED' && outcome !== 'ROTATED' && outcome !== 'REATTACHED') throw new Error('PUSH_SYNC_MALFORMED');
      return { outcome };
    });
  }

  /** Sign-out (this device): the installation stops receiving for this account and forgets its token. */
  async detach(token: string, body: unknown): Promise<{ readonly outcome: 'DETACHED' | 'NOT_ATTACHED' }> {
    const value = record(body);
    exactKeys(value, ['installationId']);
    const id = installation(value.installationId);
    return this.guard(async () => {
      const rows = await this.repository.detach(token, id);
      const outcome = Array.isArray(rows) && rows.length === 1 ? rows[0].outcome : null;
      if (outcome !== 'DETACHED' && outcome !== 'NOT_ATTACHED') throw new Error('PUSH_DETACH_MALFORMED');
      return { outcome };
    });
  }

  /** "Sign out from other devices": every other installation of this account stops receiving. */
  async detachOthers(token: string, body: unknown): Promise<{ readonly outcome: 'DETACHED' }> {
    const value = record(body);
    exactKeys(value, ['installationId']);
    const id = installation(value.installationId);
    return this.guard(async () => {
      const rows = await this.repository.detachOthers(token, id);
      if (!Array.isArray(rows) || rows.length !== 1 || !Number.isSafeInteger(rows[0].detached)) throw new Error('PUSH_DETACH_MALFORMED');
      return { outcome: 'DETACHED' };
    });
  }

  /** Per-device evidence: THIS installation's notification was tapped (D41, D53). The user-level open is Activity's. */
  async recordOpen(token: string, body: unknown): Promise<{ readonly outcome: 'RECORDED' | 'NO_EVIDENCE' }> {
    const value = record(body);
    exactKeys(value, ['installationId', 'itemId']);
    const id = installation(value.installationId);
    const itemId = typeof value.itemId === 'string' && UUID.test(value.itemId) ? value.itemId : invalid();
    return this.guard(async () => {
      const rows = await this.repository.recordOpen(token, id, itemId);
      const outcome = Array.isArray(rows) && rows.length === 1 ? rows[0].outcome : null;
      if (outcome !== 'RECORDED' && outcome !== 'NO_EVIDENCE') throw new Error('PUSH_OPEN_MALFORMED');
      return { outcome };
    });
  }

  // Refusals the caller may see stay as they are (400). Everything else fails closed as one sanitized 503.
  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
    }
  }
}
