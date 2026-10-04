import {
  CEILINGS, budgetVerdict, chooseOne, disclosureLevel, inQuietHours, interruptionVerdict, isCallSafe, localMinute, markOf,
  platformVerdict, silenceOf, type DeliveryEvidence, type PlatformInput,
} from './activity-decision';
import { DEFAULT_PREFERENCES, LOCK_DEFAULTS, type ActivityItemRow, type ActivityPreferences } from './activity.types';

const NOW = Date.parse('2026-10-04T12:00:00.000Z'); // 15:00 in Africa/Cairo (UTC+3 in October 2026)
const ZONE = 'Africa/Cairo';
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const H = 3_600_000;

function item(overrides: Partial<ActivityItemRow> = {}): ActivityItemRow {
  return {
    id: '00000000-0000-4000-8000-000000000001', category: 'SHARED', kind: 'SHARED_ACTIVITY', interruption_class: 3,
    critical: false, requested: false, context_kind: 'SHARED_WORLD', context_ref: 'world-a', context_label_ar: null,
    context_label_en: null, entry_destination: 'SHARED_WORLD', entry_ref: 'world-a', speaker: 'PRODUCT', body_ar: 'نص',
    body_en: 'text', secondary_ar: null, secondary_en: null, actionable: false, disclosure_max: 'L3', member_count: 1,
    occurred_at: iso(-60_000), last_occurred_at: iso(-60_000), expires_at: null, withdrawn_at: null, attention: 'NEW',
    presented_in_app_at: null, interruption_settled_at: null, ...overrides,
  };
}
const prefs = (overrides: Partial<ActivityPreferences> = {}): ActivityPreferences => ({ ...DEFAULT_PREFERENCES, ...overrides });
const quietOff = prefs({ quietHours: { enabled: false, start: 1380, end: 480 } });
const verdict = (row: ActivityItemRow, p: ActivityPreferences = quietOff, mutes: string[] = [], now = NOW) =>
  interruptionVerdict(row, { prefs: p, mutes: new Set(mutes), now, timeZone: ZONE });

describe('A3-01 attention decision — defaults are the frozen P3 values', () => {
  it('Quiet Hours ON 23:00 → 08:00, Public Discovery OFF, L3 never a default, Introductions L0 (D15, P3 §12–§13)', () => {
    expect(DEFAULT_PREFERENCES.quietHours).toEqual({ enabled: true, start: 23 * 60, end: 8 * 60 });
    expect(DEFAULT_PREFERENCES.publicDiscovery).toBe(false);
    expect(Object.values(LOCK_DEFAULTS)).not.toContain('L3');
    expect(LOCK_DEFAULTS.INTRODUCTIONS).toBe('L0');
    expect(LOCK_DEFAULTS).toEqual({ QANDEEL: 'L1', SHARED: 'L2', PUBLIC: 'L2', DISCOVERY: 'L1', INTRODUCTIONS: 'L0', REMINDERS: 'L2', ACCOUNT: 'L2', SECURITY: 'L2' });
  });
});

describe('A3-01 attention decision — eligibility', () => {
  it('an ordinary fresh Shared item is eligible', () => expect(verdict(item())).toBe('ELIGIBLE'));

  it('stale: expired or withdrawn items never interrupt and never carry the mark (D39, D59)', () => {
    expect(verdict(item({ expires_at: iso(-1) }))).toBe('STALE');
    expect(verdict(item({ withdrawn_at: iso(-1) }))).toBe('STALE');
    expect(markOf(item({ withdrawn_at: iso(-1) }), quietOff, new Set(), NOW)).toBe(false);
  });

  it('seen / settled items do not interrupt again; settling is not resolution', () => {
    expect(verdict(item({ attention: 'SEEN' }))).toBe('ALREADY_SEEN');
    expect(verdict(item({ interruption_settled_at: iso(-1) }))).toBe('SETTLED');
  });

  it('muting one World mutes no other (D34)', () => {
    expect(verdict(item(), quietOff, ['world-a'])).toBe('MUTED_CONTEXT');
    expect(verdict(item({ context_ref: 'world-b', entry_ref: 'world-b' }), quietOff, ['world-a'])).toBe('ELIGIBLE');
    expect(markOf(item(), quietOff, new Set(['world-a']), NOW)).toBe(false);
  });

  it('category controls: Shared alerts off, Public interactions off, account updates off', () => {
    expect(verdict(item(), prefs({ ...quietOff, sharedAlerts: false }))).toBe('CATEGORY_OFF');
    expect(verdict(item({ category: 'PUBLIC', kind: 'PUBLIC_INTERACTION', context_kind: 'PUBLIC_WORLD', entry_destination: 'NONE', entry_ref: null }), prefs({ ...quietOff, publicInteractions: false }))).toBe('CATEGORY_OFF');
    const account = item({ category: 'SYSTEM', kind: 'ACCOUNT', context_kind: 'ACCOUNT', context_ref: null, entry_destination: 'GENERAL_SETTINGS', entry_ref: 'ACCOUNT' });
    expect(verdict(account, prefs({ ...quietOff, accountUpdates: false }))).toBe('CATEGORY_OFF');
  });

  it('critical security has no in-app off switch (D36)', () => {
    const security = item({ category: 'SYSTEM', kind: 'SECURITY', critical: true, interruption_class: 1, context_kind: 'ACCOUNT', context_ref: null, entry_destination: 'GENERAL_SETTINGS', entry_ref: 'SECURITY' });
    expect(silenceOf(security, prefs({ accountUpdates: false }), new Set())).toBeNull();
    expect(verdict(security, prefs({ ...quietOff, accountUpdates: false }))).toBe('ELIGIBLE');
  });

  it('Public Discovery: opt-in (OFF by default), and never an in-app strip (P3 §7)', () => {
    const discovery = item({ category: 'PUBLIC', kind: 'PUBLIC_DISCOVERY', context_kind: 'PUBLIC_WORLD', context_ref: null, entry_destination: 'NONE', entry_ref: null });
    expect(verdict(discovery)).toBe('DISCOVERY_NOT_OPTED_IN');
    expect(verdict(discovery, prefs({ ...quietOff, publicDiscovery: true }))).toBe('DISCOVERY_NO_STRIP');
  });

  it('Introductions are never eligible before the capability is entered (D26) — no Product entry exists yet', () => {
    expect(verdict(item({ category: 'INTRODUCTIONS', kind: 'INTRODUCTION', context_kind: 'INTRODUCTIONS', entry_destination: 'NONE', entry_ref: null }))).toBe('INTRODUCTIONS_NOT_ENTERED');
  });

  it('Ambient / Class 4 never interrupts and carries no mark (D10)', () => {
    expect(verdict(item({ interruption_class: 4 }))).toBe('AMBIENT');
    expect(markOf(item({ interruption_class: 4 }), quietOff, new Set(), NOW)).toBe(false);
  });

  it('a transient interruption is for now: an item older than the freshness bound stays an Activity item', () => {
    expect(verdict(item({ last_occurred_at: iso(-25 * H), occurred_at: iso(-25 * H) }))).toBe('NOT_FRESH');
  });
});

describe('A3-01 attention decision — Proactive QANDEEL Allow / Reduce / Off (P3 §12.1, Task Contract §7)', () => {
  const proactive = item({ category: 'QANDEEL', kind: 'PROACTIVE', context_kind: 'PERSONAL', context_ref: null, entry_destination: 'PERSONAL_CONVERSATION', entry_ref: null, speaker: 'QANDEEL' });

  it('Off: no interruption and no mark — but the item stays in Activity (D35)', () => {
    expect(verdict(proactive, prefs({ ...quietOff, proactive: 'OFF' }))).toBe('PROACTIVE_OFF');
    expect(markOf(proactive, prefs({ proactive: 'OFF' }), new Set(), NOW)).toBe(false);
  });

  it('Allow and Reduce fail closed while no Proactive Gate exists: no score, class rule or threshold stands in for it', () => {
    expect(verdict(proactive, prefs({ ...quietOff, proactive: 'ALLOW' }))).toBe('PROACTIVE_GATE_ABSENT');
    expect(verdict(proactive, prefs({ ...quietOff, proactive: 'REDUCE' }))).toBe('PROACTIVE_GATE_ABSENT');
    // Even a Class 2 Timely proactive candidate: Reduce is not "Class 2 only".
    expect(verdict({ ...proactive, interruption_class: 2 }, prefs({ ...quietOff, proactive: 'REDUCE' }))).toBe('PROACTIVE_GATE_ABSENT');
    // Allow still lets the item carry its attention mark in Activity.
    expect(markOf(proactive, prefs({ proactive: 'ALLOW' }), new Set(), NOW)).toBe(true);
  });
});

describe('A3-01 attention decision — Quiet Hours, Snooze and the two exceptions (P3 §13, D06, D37)', () => {
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return Date.parse(`2026-10-04T${String((h - 3 + 24) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`);
  };
  const security = item({ category: 'SYSTEM', kind: 'SECURITY', critical: true, interruption_class: 1, context_kind: 'ACCOUNT', context_ref: null, entry_destination: 'GENERAL_SETTINGS', entry_ref: 'SECURITY' });
  const reminder = item({ category: 'QANDEEL', kind: 'REMINDER', requested: true, interruption_class: 2, context_kind: 'PERSONAL', context_ref: null, entry_destination: 'PERSONAL_CONVERSATION', entry_ref: null, speaker: 'QANDEEL' });

  it('the device-local clock decides (Africa/Cairo), not UTC', () => {
    expect(localMinute(at('23:30'), ZONE)).toBe(23 * 60 + 30);
    expect(inQuietHours(DEFAULT_PREFERENCES.quietHours, 23 * 60 + 30)).toBe(true);
    expect(inQuietHours(DEFAULT_PREFERENCES.quietHours, 7 * 60 + 59)).toBe(true);
    expect(inQuietHours(DEFAULT_PREFERENCES.quietHours, 8 * 60)).toBe(false);
    expect(inQuietHours({ enabled: false, start: 1380, end: 480 }, 23 * 60 + 30)).toBe(false);
  });

  it('inside Quiet Hours an ordinary item waits; only critical security and a requested exact-time reminder pass', () => {
    const t = at('23:30');
    const fresh = { last_occurred_at: new Date(t - 60_000).toISOString(), occurred_at: new Date(t - 60_000).toISOString() };
    expect(verdict(item(fresh), DEFAULT_PREFERENCES, [], t)).toBe('QUIET_HOURS');
    expect(verdict({ ...security, ...fresh }, DEFAULT_PREFERENCES, [], t)).toBe('ELIGIBLE');
    expect(verdict({ ...reminder, ...fresh }, DEFAULT_PREFERENCES, [], t)).toBe('ELIGIBLE');
    // A reminder the user did not request is not an exception.
    expect(verdict({ ...reminder, ...fresh, requested: false }, DEFAULT_PREFERENCES, [], t)).toBe('QUIET_HOURS');
    // A non-critical security notice is not an exception.
    expect(verdict({ ...security, ...fresh, critical: false, interruption_class: 2 }, DEFAULT_PREFERENCES, [], t)).toBe('QUIET_HOURS');
  });

  it('Snooze affects interruption only; the exceptions still pass; an ended Snooze no longer applies', () => {
    const snoozed = prefs({ ...quietOff, snoozeUntil: iso(H) });
    expect(verdict(item(), snoozed)).toBe('SNOOZED');
    expect(verdict(security, snoozed)).toBe('ELIGIBLE');
    expect(markOf(item(), snoozed, new Set(), NOW)).toBe(true);
    expect(verdict(item(), prefs({ ...quietOff, snoozeUntil: iso(-1) }))).toBe('ELIGIBLE');
  });

  it('isCallSafe admits exactly the two P3 §9 exceptions', () => {
    expect(isCallSafe(security)).toBe(true);
    expect(isCallSafe(reminder)).toBe(true);
    expect(isCallSafe({ ...reminder, requested: false })).toBe(false);
    expect(isCallSafe({ ...security, critical: false })).toBe(false);
    expect(isCallSafe(item())).toBe(false);
  });
});

describe('A3-01 attention decision — disclosure (D14–D17)', () => {
  it('the lower ceiling wins; critical importance never raises disclosure', () => {
    const security = item({ category: 'SYSTEM', kind: 'SECURITY', critical: true, interruption_class: 1, disclosure_max: 'L3' });
    expect(disclosureLevel(security, DEFAULT_PREFERENCES)).toBe('L2');
    expect(disclosureLevel(item({ disclosure_max: 'L1' }), prefs({ lock: { ...LOCK_DEFAULTS, SHARED: 'L3' } }))).toBe('L1');
    expect(disclosureLevel(item({ category: 'INTRODUCTIONS', kind: 'INTRODUCTION' }), DEFAULT_PREFERENCES)).toBe('L0');
  });
});

describe('A3-01 attention decision — ceilings over delivery EVIDENCE, and re-evaluation without a dump', () => {
  const pushes = (n: number, kind: DeliveryEvidence['kind'] = 'SHARED_ACTIVITY', spanMs = H): DeliveryEvidence[] =>
    Array.from({ length: n }, (_, i) => ({ at: NOW - (i + 1) * spanMs, kind, critical: false, requested: false }));
  const ordinary = { kind: 'SHARED_ACTIVITY' as const, critical: false, requested: false };

  it('ordinary: at most 4 per rolling 24 h and 12 per rolling 7 days (P3 §14)', () => {
    expect(CEILINGS.ordinary).toEqual({ per24h: 4, per7d: 12 });
    expect(budgetVerdict(ordinary, pushes(3), NOW)).toEqual({ ok: true, outside: false });
    expect(budgetVerdict(ordinary, pushes(4), NOW)).toEqual({ ok: false, reason: 'ordinary-24h' });
    expect(budgetVerdict(ordinary, pushes(12, 'SHARED_ACTIVITY', 13 * H), NOW)).toEqual({ ok: false, reason: 'ordinary-7d' });
  });

  it('Proactive: 1 / 24 h, 3 / 7 d, and 48 h on the same unengaged thread', () => {
    const proactive = { kind: 'PROACTIVE' as const, critical: false, requested: false, thread: 't1' };
    expect(budgetVerdict(proactive, [{ at: NOW - 6 * H, kind: 'PROACTIVE', critical: false, requested: false }], NOW)).toEqual({ ok: false, reason: 'proactive-24h' });
    expect(budgetVerdict(proactive, pushes(3, 'PROACTIVE', 30 * H), NOW)).toEqual({ ok: false, reason: 'proactive-7d' });
    expect(budgetVerdict(proactive, [{ at: NOW - 25.5 * H, kind: 'PROACTIVE', critical: false, requested: false, thread: 't1', engaged: false }], NOW)).toEqual({ ok: false, reason: 'same-thread-48h' });
    expect(budgetVerdict(proactive, [{ at: NOW - 48.5 * H, kind: 'PROACTIVE', critical: false, requested: false, thread: 't1', engaged: false }], NOW)).toEqual({ ok: true, outside: false });
  });

  it('Public Discovery: at most 1 per rolling 7 days', () => {
    expect(budgetVerdict({ kind: 'PUBLIC_DISCOVERY', critical: false, requested: false }, pushes(1, 'PUBLIC_DISCOVERY', 48 * H), NOW)).toEqual({ ok: false, reason: 'discovery-7d' });
  });

  it('the two exceptions sit outside ordinary budget competition, even when the week is spent (D08)', () => {
    expect(budgetVerdict({ kind: 'SECURITY', critical: true, requested: false }, pushes(12), NOW)).toEqual({ ok: true, outside: true });
    expect(budgetVerdict({ kind: 'REMINDER', critical: false, requested: true }, pushes(12), NOW)).toEqual({ ok: true, outside: true });
  });

  it('ceiling ≠ quota: unused budget never creates a delivery — no evidence and no candidate means nothing', () => {
    expect(chooseOne([])).toEqual({ chosen: null, settled: [] });
  });

  it('platform verdict: foreground means no external interruption (D51); OS permission is a hard boundary (D50)', () => {
    const input = (o: Partial<PlatformInput> = {}): PlatformInput => ({ prefs: quietOff, mutes: new Set(), now: NOW, timeZone: ZONE, evidence: [], osPermission: 'GRANTED', foreground: false, ...o });
    expect(platformVerdict(item(), input({ foreground: true }))).toEqual({ deliver: false, reason: 'IN_PRODUCT_ATTENTION' });
    expect(platformVerdict(item(), input({ osPermission: 'DENIED' }))).toEqual({ deliver: false, reason: 'OS_PERMISSION' });
    expect(platformVerdict(item(), input())).toEqual({ deliver: true, level: 'L2' });
    expect(platformVerdict(item(), input({ evidence: pushes(4) }))).toEqual({ deliver: false, reason: 'ordinary-24h' });
  });

  it('re-evaluation chooses AT MOST ONE; the rest settle to Activity — no morning dump', () => {
    const waiting = [
      item({ id: 'a', interruption_class: 3, last_occurred_at: iso(-3 * H) }),
      item({ id: 'b', interruption_class: 2, last_occurred_at: iso(-5 * H) }),
      item({ id: 'c', interruption_class: 2, last_occurred_at: iso(-1 * H) }),
      item({ id: 'd', interruption_class: 3, last_occurred_at: iso(-2 * H) }),
    ];
    const { chosen, settled } = chooseOne(waiting);
    expect(chosen?.id).toBe('c');
    expect(settled.map((s) => s.id).sort()).toEqual(['a', 'b', 'd']);
  });

  it('at 08:00 every waiting candidate is decided again: the stale one goes stale, nothing is released merely for waiting', () => {
    const eight = Date.parse('2026-10-05T05:00:00.000Z'); // 08:00 Cairo
    const waited = item({ last_occurred_at: new Date(eight - 8 * H).toISOString(), occurred_at: new Date(eight - 8 * H).toISOString() });
    const closedVote = item({ id: 'v', expires_at: new Date(eight - H).toISOString(), last_occurred_at: new Date(eight - 6 * H).toISOString(), occurred_at: new Date(eight - 6 * H).toISOString() });
    expect(verdict(waited, DEFAULT_PREFERENCES, [], eight)).toBe('ELIGIBLE');
    expect(verdict(closedVote, DEFAULT_PREFERENCES, [], eight)).toBe('STALE');
  });
});
