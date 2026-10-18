import { BadRequestException, Body, Controller, Get, Injectable, Param, Put, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const NAME_MAX = 80;

/** One per-Introduction row of Notifications & Activity: the World, its state, the handoff first name and its mute. */
export interface IntroductionWorldAlertView {
  readonly worldId: string;
  readonly state: 'ACTIVE' | 'ENDED';
  /** The first name the Match's handoff presented to this reader (S6-02), or null (a retained view: IW-11b covers it). */
  readonly otherFirstName: string | null;
  readonly muted: boolean;
}
export interface IntroductionWorldAlertsView { readonly worlds: readonly IntroductionWorldAlertView[] }
export type IntroductionWorldAlertSetView = { readonly outcome: 'MUTED' | 'UNMUTED' | 'UNAVAILABLE' };

const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' }); };

/** Exactly migration 0167's two owner commands, on the caller's OWN token: the database derives the human. */
@Injectable()
export class IntroductionWorldAlertsRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  list(token: string): Promise<unknown> {
    return this.dataApi.request<unknown>(token, 'rpc/list_own_introduction_world_alerts_v1', { method: 'POST', body: '{}' });
  }

  set(token: string, worldId: string, muted: boolean): Promise<unknown> {
    return this.dataApi.request<unknown>(token, 'rpc/set_own_introduction_world_alerts_v1', {
      method: 'POST', body: JSON.stringify({ p_world_id: worldId, p_muted: muted }),
    });
  }
}

/**
 * S6-07 (CP3) — the per-Introduction mute (I-08N-01 D34; P3 §12.2), beside the global Introductions alerts control that
 * Activity already owns. It lists exactly the caller's own Introduction Worlds (the S6-05 discovery read: ACTIVE, ENDED,
 * retained) and mutes / unmutes ONE of them; anything else — not theirs, unknown, erased, made Standard — is one
 * UNAVAILABLE. Muting changes notification and attention presentation only: never the Introduction, its messages, its
 * sharing or its END. Nothing is logged; no count is answered.
 */
@Injectable()
export class IntroductionWorldAlertsService {
  constructor(private readonly repository: IntroductionWorldAlertsRepository) {}

  list(token: string): Promise<IntroductionWorldAlertsView> {
    return this.guard(async () => {
      const rows = await this.repository.list(token);
      if (!Array.isArray(rows)) return unavailable();
      return {
        worlds: rows.map((row: unknown) => {
          const r = row && typeof row === 'object' ? row as Record<string, unknown> : {};
          if (Object.keys(r).length !== 4 || typeof r.world_id !== 'string' || !UUID.test(r.world_id)
              || (r.introduction_state !== 'ACTIVE' && r.introduction_state !== 'ENDED') || typeof r.muted !== 'boolean'
              || !(r.other_first_name === null || (typeof r.other_first_name === 'string' && r.other_first_name.length > 0))) return unavailable();
          return {
            worldId: r.world_id, state: r.introduction_state, muted: r.muted,
            otherFirstName: r.other_first_name === null ? null : (r.other_first_name as string).slice(0, NAME_MAX),
          };
        }),
      };
    });
  }

  async set(token: string, worldId: string, body: unknown): Promise<IntroductionWorldAlertSetView> {
    const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    if (Object.keys(value).length !== 1 || typeof value.muted !== 'boolean') invalid();
    if (!UUID.test(worldId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      const rows = await this.repository.set(token, worldId.toLowerCase(), value.muted as boolean);
      const row = Array.isArray(rows) && rows.length === 1 ? rows[0] as Record<string, unknown> : null;
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

/**
 * S6-07 (CP3, migration 0167) — the per-Introduction alerts. Owner-only; identity is the verified token.
 *
 *   GET /introductions/alerts                       -> { worlds: [{ worldId, state, otherFirstName, muted }] }
 *   PUT /introductions/worlds/:worldId/alerts       { muted } -> { outcome: MUTED | UNMUTED | UNAVAILABLE }
 */
@Controller('introductions')
@UseGuards(SupabaseAuthGuard)
export class IntroductionWorldAlertsController {
  constructor(private readonly alerts: IntroductionWorldAlertsService) {}

  @Get('alerts')
  list(@Req() request: AuthenticatedRequest) {
    return this.alerts.list(request.authenticatedUser.accessToken);
  }

  @Put('worlds/:worldId/alerts')
  set(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.alerts.set(request.authenticatedUser.accessToken, worldId, body);
  }
}
