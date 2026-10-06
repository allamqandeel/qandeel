import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import {
  ACTIVITY_ATTENTION_READ_MAX, ACTIVITY_MUTES_READ_MAX, type ActivityCategory, type ActivityItemRow,
} from './activity.types';

/** The selected projection columns. Member identities and source references are never selected (the table is server-only). */
export const ITEM_COLUMNS = [
  'id', 'category', 'kind', 'interruption_class', 'critical', 'requested', 'context_kind', 'context_ref', 'context_label_ar',
  'context_label_en', 'entry_destination', 'entry_ref', 'speaker', 'body_ar', 'body_en', 'secondary_ar', 'secondary_en',
  'actionable', 'disclosure_max', 'member_count', 'occurred_at', 'last_occurred_at', 'expires_at', 'withdrawn_at', 'attention',
  'presented_in_app_at', 'interruption_settled_at',
].join(',');

export interface ActivityPreferencesRow {
  readonly proactive: string;
  readonly shared_alerts: boolean;
  readonly public_interactions: boolean;
  readonly public_discovery: boolean;
  readonly introductions_alerts: boolean;
  readonly account_updates: boolean;
  readonly quiet_hours_enabled: boolean;
  readonly quiet_hours_start: number;
  readonly quiet_hours_end: number;
  readonly snooze_until: string | null;
  readonly lock_qandeel: string;
  readonly lock_shared: string;
  readonly lock_public: string;
  readonly lock_discovery: string;
  readonly lock_introductions: string;
  readonly lock_reminders: string;
  readonly lock_account: string;
  readonly lock_security: string;
}

export interface ActivityOpenRow {
  readonly outcome: 'OPENED' | 'STALE' | 'NOT_FOUND';
  readonly category: ActivityCategory | null;
  readonly context_kind: string | null;
  readonly context_ref: string | null;
  readonly entry_destination: string | null;
  readonly entry_ref: string | null;
}

/** The anchor of a keyset page. */
export interface ActivityAnchor { readonly id: string; readonly last_occurred_at: string }

/** One publication, exactly the 0136 server pass's parameters. */
export interface ActivityPublication {
  readonly p_user_id: string; readonly p_candidate_key: string; readonly p_source_ref: string; readonly p_category: string;
  readonly p_kind: string; readonly p_interruption_class: number; readonly p_critical: boolean; readonly p_requested: boolean;
  readonly p_context_kind: string; readonly p_context_ref: string | null; readonly p_context_label_ar: string | null;
  readonly p_context_label_en: string | null; readonly p_entry_destination: string; readonly p_entry_ref: string | null;
  readonly p_speaker: string; readonly p_body_ar: string | null; readonly p_body_en: string | null;
  readonly p_secondary_ar: string | null; readonly p_secondary_en: string | null; readonly p_actionable: boolean;
  readonly p_disclosure_max: string; readonly p_occurred_at: string; readonly p_expires_at: string | null;
}

/**
 * Activity reads and commands (migration 0136). Every read is owner-SELECT under RLS with the CALLER'S token and is
 * additionally filtered by the caller's own user id; every owner command derives the owner from `auth.uid()`. Only the
 * two server passes use the server channel, and no route reaches them.
 */
@Injectable()
export class ActivityRepository {
  constructor(private readonly dataApi: SupabaseDataApiService, private readonly server: SupabaseServiceRoleApiService) {}

  /** One keyset page, newest first, `limit + 1` rows so the service knows whether an older page exists. */
  page(token: string, userId: string, limit: number, category: ActivityCategory | null, anchor: ActivityAnchor | null): Promise<ActivityItemRow[]> {
    const query = new URLSearchParams({ select: ITEM_COLUMNS, user_id: `eq.${userId}`, order: 'last_occurred_at.desc,id.desc', limit: String(limit + 1) });
    if (category !== null) query.set('category', `eq.${category}`);
    if (anchor !== null) {
      query.set('or', `(last_occurred_at.lt."${anchor.last_occurred_at}",and(last_occurred_at.eq."${anchor.last_occurred_at}",id.lt.${anchor.id}))`);
    }
    return this.dataApi.request<ActivityItemRow[]>(token, `activity_items?${query}`);
  }

  anchor(token: string, userId: string, itemId: string): Promise<ActivityAnchor[]> {
    const query = new URLSearchParams({ select: 'id,last_occurred_at', user_id: `eq.${userId}`, id: `eq.${itemId}`, limit: '1' });
    return this.dataApi.request<ActivityAnchor[]>(token, `activity_items?${query}`);
  }

  /** Every item that can carry attention now (NEW, or actionable and SEEN), bounded. */
  attentionItems(token: string, userId: string): Promise<ActivityItemRow[]> {
    const query = new URLSearchParams({
      select: ITEM_COLUMNS, user_id: `eq.${userId}`, or: '(attention.eq.NEW,and(actionable.is.true,attention.eq.SEEN))',
      order: 'last_occurred_at.desc,id.desc', limit: String(ACTIVITY_ATTENTION_READ_MAX),
    });
    return this.dataApi.request<ActivityItemRow[]>(token, `activity_items?${query}`);
  }

  preferences(token: string, userId: string): Promise<ActivityPreferencesRow[]> {
    const query = new URLSearchParams({ select: '*', user_id: `eq.${userId}`, limit: '1' });
    return this.dataApi.request<ActivityPreferencesRow[]>(token, `activity_preferences?${query}`);
  }

  mutes(token: string, userId: string): Promise<{ readonly context_ref: string }[]> {
    const query = new URLSearchParams({ select: 'context_ref', user_id: `eq.${userId}`, limit: String(ACTIVITY_MUTES_READ_MAX) });
    return this.dataApi.request<{ readonly context_ref: string }[]>(token, `activity_context_mutes?${query}`);
  }

  markSeen(token: string, itemIds: readonly string[]): Promise<unknown> {
    return this.dataApi.request<unknown>(token, 'rpc/mark_own_activity_items_seen_v1', { method: 'POST', body: JSON.stringify({ p_item_ids: itemIds }) });
  }

  open(token: string, itemId: string): Promise<ActivityOpenRow[]> {
    return this.dataApi.request<ActivityOpenRow[]>(token, 'rpc/open_own_activity_item_v1', { method: 'POST', body: JSON.stringify({ p_item_id: itemId }) });
  }

  recordStrip(token: string, presentedItemId: string | null, settledItemIds: readonly string[]): Promise<unknown> {
    return this.dataApi.request<unknown>(token, 'rpc/record_own_activity_strip_v1', {
      method: 'POST', body: JSON.stringify({ p_presented_item_id: presentedItemId, p_settled_item_ids: settledItemIds }),
    });
  }

  savePreferences(token: string, row: Omit<ActivityPreferencesRow, 'snooze_until'>): Promise<unknown> {
    return this.dataApi.request<unknown>(token, 'rpc/set_own_activity_preferences_v1', {
      method: 'POST',
      body: JSON.stringify({
        p_proactive: row.proactive, p_shared_alerts: row.shared_alerts, p_public_interactions: row.public_interactions,
        p_public_discovery: row.public_discovery, p_introductions_alerts: row.introductions_alerts,
        p_account_updates: row.account_updates, p_quiet_hours_enabled: row.quiet_hours_enabled,
        p_quiet_hours_start: row.quiet_hours_start, p_quiet_hours_end: row.quiet_hours_end, p_lock_qandeel: row.lock_qandeel,
        p_lock_shared: row.lock_shared, p_lock_public: row.lock_public, p_lock_discovery: row.lock_discovery,
        p_lock_introductions: row.lock_introductions, p_lock_reminders: row.lock_reminders, p_lock_account: row.lock_account,
        p_lock_security: row.lock_security,
      }),
    });
  }

  setSnooze(token: string, until: string | null): Promise<unknown> {
    return this.dataApi.request<unknown>(token, 'rpc/set_own_activity_snooze_v1', { method: 'POST', body: JSON.stringify({ p_until: until }) });
  }

  /**
   * S4-04 — the Shared entry verdict for ONE World, on the CALLER'S token, through the existing S4-01 owner wrapper
   * (migration 0138). Activity reads no Connected Worlds table: it asks the Shared domain's own Product-safe verdict,
   * which is ALLOW only for a current member of an ACTIVE World and one neutral UNAVAILABLE otherwise.
   */
  sharedEntry(token: string, worldId: string): Promise<{ readonly outcome: string; readonly world_id: string | null }[]> {
    return this.dataApi.request<{ readonly outcome: string; readonly world_id: string | null }[]>(token, 'rpc/resolve_own_shared_world_entry_v1', {
      method: 'POST', body: JSON.stringify({ p_world_id: worldId }),
    });
  }

  setMute(token: string, contextRef: string, muted: boolean): Promise<{ readonly outcome: string }[]> {
    return this.dataApi.request<{ readonly outcome: string }[]>(token, 'rpc/set_own_activity_context_mute_v1', {
      method: 'POST', body: JSON.stringify({ p_context_ref: contextRef, p_muted: muted }),
    });
  }

  /** Server channel only. */
  publish(publication: ActivityPublication): Promise<{ readonly outcome: string; readonly item_id: string }[]> {
    return this.server.rpc<{ readonly outcome: string; readonly item_id: string }[]>('server_publish_activity_candidate_v1', { ...publication });
  }

  /** Server channel only. */
  withdraw(userId: string, sourceRef: string): Promise<{ readonly withdrawn_items: number }[]> {
    return this.server.rpc<{ readonly withdrawn_items: number }[]>('server_withdraw_activity_source_v1', { p_user_id: userId, p_source_ref: sourceRef });
  }
}
