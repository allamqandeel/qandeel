import { chooseOne, isStale, localMinute, platformVerdict, type DeliveryEvidence } from '../activity/activity-decision';
import { preferencesFromRow } from '../activity/activity.service';
import { DEFAULT_PREFERENCES, type ActivityPreferences, type DisclosureLevel } from '../activity/activity.types';
import type { ActivityPreferencesRow } from '../activity/activity.repository';
import { projectForPlatform, ttlSecondsOf } from './push-projection';
import type { ClaimedAttempt, PlatformMessage } from './push.types';

/**
 * A3-02 — the revalidation every claimed delivery intent passes BEFORE any transport, every time (I-08N-01 D54, D55):
 * retry preserves the intent, never stale authority, eligibility or disclosure. It asks A3-01's own `platformVerdict`
 * (the ONE Product verdict: controls, mutes, the absent Proactive Gate, Quiet Hours / Snooze in the DEVICE's zone,
 * freshness, OS permission, the P3 §14 ceilings over delivery evidence, the disclosure level) and adds only what a
 * device / transport knows: the registration is still live, the semantic window is still open.
 *
 * Foreground (D51) is decided by EVIDENCE, never guessed: a reader in the app gets the item in-app first (the intent
 * waits 60 s), and A3-01 records that — presented as a strip, or settled in place / in its origin — so this verdict reads
 * SETTLED or ALREADY_SEEN and nothing is pushed. A message that still arrives while the app is in front is not presented
 * by the device (the app's notification handler; A3-01's in-app law owns it).
 */
export type DispatchDecision =
  | { readonly kind: 'SEND'; readonly level: DisclosureLevel; readonly message: PlatformMessage }
  /** Quiet Hours / Snooze: wait, then RE-EVALUATE (never flush) — at most one per reader per pass. */
  | { readonly kind: 'DEFER'; readonly until: number; readonly reason: 'quiet_hours' | 'snoozed' }
  | { readonly kind: 'SUPPRESS'; readonly reason: string }
  /** D59: the timing window ended; never retried past it. */
  | { readonly kind: 'EXPIRE'; readonly reason: 'stale' | 'not_fresh' | 'window_closed' };

const lower = (reason: string) => reason.toLowerCase().replace(/[^a-z0-9_-]/gu, '_').slice(0, 48);

export function preferencesOfClaim(row: Record<string, unknown> | null): ActivityPreferences {
  return row === null ? DEFAULT_PREFERENCES : preferencesFromRow(row as unknown as ActivityPreferencesRow);
}

/** The next moment the device-local Quiet Hours window is over (P3 §13), to the minute. */
export function quietHoursEnd(prefs: ActivityPreferences, timeZone: string, now: number): number {
  const minute = localMinute(now, timeZone);
  const wait = (prefs.quietHours.end - minute + 1440) % 1440;
  const startOfMinute = now - (now % 60_000);
  return startOfMinute + (wait === 0 ? 1440 : wait) * 60_000;
}

export function decideDispatch(claim: ClaimedAttempt, now: number): DispatchDecision {
  const { item, device } = claim;
  if (device.status !== 'ACTIVE' || device.token === null) return { kind: 'SUPPRESS', reason: 'device_unavailable' };
  if (isStale(item, now)) return { kind: 'EXPIRE', reason: 'stale' };
  const prefs = preferencesOfClaim(claim.preferences);
  const evidence: DeliveryEvidence[] = claim.evidence.map((e) => ({ at: Date.parse(e.at), kind: e.kind, critical: e.critical, requested: e.requested }));
  const verdict = platformVerdict(item, {
    prefs,
    mutes: new Set(claim.muted && item.context_ref !== null ? [item.context_ref] : []),
    now,
    timeZone: device.timeZone,
    evidence,
    osPermission: device.osPermission,
    // The server cannot see the screen; in-app attention is read from A3-01's evidence (above), never inferred.
    foreground: false,
  });
  if (!verdict.deliver) {
    switch (verdict.reason) {
      case 'QUIET_HOURS': return { kind: 'DEFER', until: quietHoursEnd(prefs, device.timeZone, now), reason: 'quiet_hours' };
      case 'SNOOZED': return { kind: 'DEFER', until: Date.parse(prefs.snoozeUntil as string), reason: 'snoozed' };
      case 'STALE': return { kind: 'EXPIRE', reason: 'stale' };
      case 'NOT_FRESH': return { kind: 'EXPIRE', reason: 'not_fresh' };
      default: return { kind: 'SUPPRESS', reason: lower(verdict.reason) };
    }
  }
  const message = projectForPlatform(item, verdict.level, device.locale, now);
  if (message.ttlSeconds <= 0) return { kind: 'EXPIRE', reason: 'window_closed' };
  return { kind: 'SEND', level: verdict.level, message };
}

/** Whether a deferral still lands inside the item's semantic window; if not, it expires now (D59). */
export function deferralOutlivesItem(claim: ClaimedAttempt, until: number, now: number): boolean {
  return until - now >= ttlSecondsOf(claim.item, now) * 1000;
}

/**
 * One reader's claimed intents, in the order a pass judges them: A3-01's `chooseOne` order (lowest class, then freshest)
 * — so the first re-evaluated item that may interrupt is exactly the one `chooseOne` would choose.
 */
export function orderForPass(claims: readonly ClaimedAttempt[]): ClaimedAttempt[] {
  const rank = new Map<string, number>();
  const { chosen, settled } = chooseOne([...new Map(claims.map((c) => [c.item.id, c.item])).values()]);
  [chosen, ...settled].forEach((item, index) => { if (item) rank.set(item.id, index); });
  return [...claims].sort((a, b) => (rank.get(a.item.id) ?? 0) - (rank.get(b.item.id) ?? 0) || a.attemptId.localeCompare(b.attemptId));
}

/**
 * P3 §8 / §13 and the backlog Exit Gate: after Quiet Hours / Snooze, waiting intents are RE-EVALUATED and at most ONE
 * item per reader interrupts per pass; every other re-evaluated item stays an Activity item (its intents are suppressed
 * as `reevaluated_not_chosen`) — no morning dump. One item may still reach several of the reader's devices: that is one
 * interruption, not several (D53). Fresh, never-deferred intents are not part of a re-evaluation.
 */
export class ReevaluationPass {
  private chosen: string | null = null;

  admit(claim: ClaimedAttempt, decision: DispatchDecision): DispatchDecision {
    if (!claim.reevaluation || decision.kind !== 'SEND') return decision;
    this.chosen ??= claim.item.id;
    return this.chosen === claim.item.id ? decision : { kind: 'SUPPRESS', reason: 'reevaluated_not_chosen' };
  }
}
