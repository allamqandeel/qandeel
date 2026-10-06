import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SharedWorldAlertsRepository } from './shared-world-alerts.repository';
import { SharedWorldLifecycleRepository } from './shared-world-lifecycle.repository';
import { SharedWorldRepository } from './shared-world.repository';
import type { SharedMemberView } from './shared-world.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** One per-World row of Notifications & Activity: the World's own label facts and whether the reader muted it. */
export interface SharedWorldAlertView {
  readonly worldId: string;
  /** The World's committed name; null keeps the S4-01 member-name label. */
  readonly name: string | null;
  readonly members: readonly SharedMemberView[];
  readonly muted: boolean;
}
export interface SharedWorldAlertsView { readonly worlds: readonly SharedWorldAlertView[] }
export type SharedWorldAlertSetView = { readonly outcome: 'MUTED' | 'UNMUTED' | 'UNAVAILABLE' };

const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Shared World is unavailable.'); };

/**
 * S4-04 — the per-World Shared mute (I-08N-01 D34; P3 §12.2), next to the global Shared World alerts control that
 * Activity already owns. It lists only the reader's CURRENT Worlds — the same safe S4-01 reads the Shared root uses —
 * and mutes / unmutes ONE World the database authorizes by the entry law. Muting changes notification and attention
 * presentation only: never membership, material, conversation, QANDEEL's understanding or Shared authority. No count,
 * no ended, former or hidden World, and nothing logged.
 */
@Injectable()
export class SharedWorldAlertsService {
  constructor(
    private readonly alerts: SharedWorldAlertsRepository,
    private readonly shared: SharedWorldRepository,
    private readonly lifecycle: SharedWorldLifecycleRepository,
  ) {}

  list(token: string): Promise<SharedWorldAlertsView> {
    return this.guard(async () => {
      const [rows, memberRows, nameRows] = await Promise.all([this.alerts.list(token), this.shared.listMembers(token), this.lifecycle.worldNames(token)]);
      if (rows.some((r) => typeof r.world_id !== 'string' || !UUID.test(r.world_id) || typeof r.muted !== 'boolean')) return unavailable();
      return {
        worlds: rows.map((r) => ({
          worldId: r.world_id,
          name: nameRows.find((n) => n.world_id === r.world_id)?.world_name ?? null,
          members: memberRows.filter((m) => m.world_id === r.world_id).map((m) => ({ name: m.member_name, self: m.is_self === true })),
          muted: r.muted,
        })),
      };
    });
  }

  async set(token: string, worldId: string, body: unknown): Promise<SharedWorldAlertSetView> {
    const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    if (Object.keys(value).length !== 1 || typeof value.muted !== 'boolean') invalid();
    if (!UUID.test(worldId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      const [row] = await this.alerts.set(token, worldId, value.muted as boolean);
      if (row?.outcome === 'MUTED' || row?.outcome === 'UNMUTED' || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }
}
