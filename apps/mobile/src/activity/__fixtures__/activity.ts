/**
 * A3-01 — validation fixtures for Activity. Every event sentence here is SYNTHETIC test text (P3 `FIXTURE_ONLY` class):
 * it exercises the surfaces and is never Product copy. Nothing here is reachable from a Product route.
 */
import type { ActivityAttentionSnapshot, ActivityItem, ActivityPreferences, InterruptionCandidate } from '../../runtime-entry';

let next = 1;
export const itemId = () => `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`;

export function item(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: itemId(), category: 'SYSTEM', speaker: 'PRODUCT', at: new Date(Date.now() - 60_000).toISOString(), context: null,
    body: { ar: 'نص اختبار', en: 'fixture event' }, secondary: null, attention: 'NEW', actionable: false, waiting: false, stale: false,
    muted: false, mark: true, entry: 'AVAILABLE', ...overrides,
  };
}

export function candidate(overrides: Partial<ActivityItem> = {}, extra: Partial<Omit<InterruptionCandidate, 'item'>> = {}): InterruptionCandidate {
  return { item: item(overrides), interruptionClass: 3, contextKind: 'ACCOUNT', callSafe: false, ...extra };
}

export function snapshot(interruptions: readonly InterruptionCandidate[] = [], present = interruptions.length > 0): ActivityAttentionSnapshot {
  return {
    present,
    categories: {
      QANDEEL: { present: false }, SHARED: { present: false, count: null }, PUBLIC: { present: false },
      INTRODUCTIONS: { present: false }, SYSTEM: { present, count: null },
    },
    interruptions,
  };
}

export const PREFERENCES: ActivityPreferences = Object.freeze<ActivityPreferences>({
  proactive: 'ALLOW', shared: { alerts: true }, public: { interactions: true, discovery: false },
  introductions: { available: false, alerts: true }, account: { updates: true },
  quietHours: { enabled: true, start: '23:00', end: '08:00' }, snoozeUntil: null,
  lockScreen: { QANDEEL: 'L1', SHARED: 'L2', PUBLIC: 'L2', DISCOVERY: 'L1', INTRODUCTIONS: 'L0', REMINDERS: 'L2', ACCOUNT: 'L2', SECURITY: 'L2' },
});

/** The wire body of an item, exactly as the API sends it. */
export const wireItem = (value: ActivityItem): Record<string, unknown> => ({ ...value });
