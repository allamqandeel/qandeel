import {
  DISCLOSURE_LEVELS, EXECUTABLE_DESTINATIONS, INTERRUPTION_FRESHNESS_MS, type ActivityItemRow, type ActivityPreferences,
  type DisclosureLevel, type LockSubject,
} from './activity.types';

/**
 * A3-01 — the pure Product attention decision (I-08N-01 §19; P3 §6–§15). It decides interruption ELIGIBILITY and
 * attention presentation facts; it never creates a candidate, never ranks by a score, and never touches source truth.
 *
 * It is split along where the truth lives:
 *   - here, on the server: everything the server owns — preferences, mutes, Quiet Hours / Snooze (in the device's own
 *     time zone, supplied per request), staleness, the Proactive Gate's (absent) verdict, and the P3 §14 ceilings over
 *     delivery EVIDENCE for the platform channel (A3-02);
 *   - on the device: only what the device alone knows — foreground, which Product surface is in front (the Analysis or
 *     not), whether that surface is the event's origin, whether a Live Call is known, and at most one strip at a time.
 */

/** I-08N-01 §4 — the Proactive Gate. No runtime exists on `main`; its absence is a typed answer, never a guess. */
export type ProactiveGateVerdict = 'ABSENT';
export const PROACTIVE_GATE: ProactiveGateVerdict = 'ABSENT';

/** D26 — Introductions eligibility needs the capability legitimately entered. No Product entry exists today (Stage 6). */
export const INTRODUCTIONS_ENTERED = false;

export type Silence = 'MUTED_CONTEXT' | 'CATEGORY_OFF' | 'INTRODUCTIONS_NOT_ENTERED' | 'DISCOVERY_NOT_OPTED_IN' | 'PROACTIVE_OFF';

export type InterruptionReason =
  | 'ELIGIBLE' | 'STALE' | 'ALREADY_SEEN' | 'SETTLED' | Silence | 'PROACTIVE_GATE_ABSENT' | 'AMBIENT' | 'DISCOVERY_NO_STRIP'
  | 'SNOOZED' | 'QUIET_HOURS' | 'NOT_FRESH';

const ms = (iso: string | null): number | null => (iso === null ? null : Date.parse(iso));

/** D39 / D59 / withdrawn source: the item no longer has a valid present. Unknown is never valid. */
export function isStale(item: Pick<ActivityItemRow, 'withdrawn_at' | 'expires_at'>, now: number): boolean {
  if (item.withdrawn_at !== null) return true;
  const expires = ms(item.expires_at);
  return expires !== null && expires <= now;
}

/** D06 / D36 / P3 §9 — the only two exceptions, and nothing else. */
export function isCallSafe(item: Pick<ActivityItemRow, 'kind' | 'critical' | 'requested'>): boolean {
  return (item.kind === 'SECURITY' && item.critical) || (item.kind === 'REMINDER' && item.requested);
}

/** What silences an item's attention (no mark, no interruption) — the user's own controls and capability authority. */
export function silenceOf(item: ActivityItemRow, prefs: ActivityPreferences, mutes: ReadonlySet<string>): Silence | null {
  switch (item.category) {
    case 'SHARED':
      if (item.context_ref !== null && mutes.has(item.context_ref)) return 'MUTED_CONTEXT';
      return prefs.sharedAlerts ? null : 'CATEGORY_OFF';
    case 'PUBLIC':
      if (item.kind === 'PUBLIC_DISCOVERY') return prefs.publicDiscovery ? null : 'DISCOVERY_NOT_OPTED_IN';
      return prefs.publicInteractions ? null : 'CATEGORY_OFF';
    case 'INTRODUCTIONS':
      if (!INTRODUCTIONS_ENTERED) return 'INTRODUCTIONS_NOT_ENTERED';
      return prefs.introductionsAlerts ? null : 'CATEGORY_OFF';
    case 'SYSTEM':
      // D36: critical security has no in-app off switch.
      if (item.kind === 'SECURITY' && item.critical) return null;
      return prefs.accountUpdates ? null : 'CATEGORY_OFF';
    case 'QANDEEL':
      if (item.kind === 'PROACTIVE' && prefs.proactive === 'OFF') return 'PROACTIVE_OFF';
      return null;
  }
}

/** P3 §4: seen, and still needing the user. Opening it quietens it. */
export const isWaiting = (item: ActivityItemRow, now: number): boolean =>
  item.actionable && item.attention === 'SEEN' && !isStale(item, now);

/**
 * P3 §6 / D44 — the attention mark: attention-worthy and not yet at the right attention state. Stale, muted, silenced
 * and ambient (Class 4) items never carry it.
 */
export function markOf(item: ActivityItemRow, prefs: ActivityPreferences, mutes: ReadonlySet<string>, now: number): boolean {
  if (isStale(item, now) || silenceOf(item, prefs, mutes) !== null || item.interruption_class >= 4) return false;
  return item.attention === 'NEW' || isWaiting(item, now);
}

/** Minutes past local midnight in an IANA time zone. An unknown zone is a refusal upstream, never a guess here. */
export function localMinute(now: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  return hour * 60 + minute;
}

/** P3 §13: device-local Quiet Hours; the window may cross midnight. */
export function inQuietHours(quiet: ActivityPreferences['quietHours'], minute: number): boolean {
  if (!quiet.enabled) return false;
  return quiet.start < quiet.end ? minute >= quiet.start && minute < quiet.end : minute >= quiet.start || minute < quiet.end;
}

export const isSnoozed = (prefs: ActivityPreferences, now: number): boolean => {
  const until = ms(prefs.snoozeUntil);
  return until !== null && now < until;
};

export interface InterruptionInput {
  readonly prefs: ActivityPreferences;
  readonly mutes: ReadonlySet<string>;
  readonly now: number;
  readonly timeZone: string;
  readonly gate?: ProactiveGateVerdict;
}

/**
 * Is this item eligible to interrupt the user now, by everything the SERVER knows? (The device then applies the
 * foreground / Analysis / origin / Live Call / one-at-a-time law.) The order follows I-08N-01 §19: truth and authority
 * first, then category eligibility and controls, the Proactive Gate, interruption value, then timing.
 */
export function interruptionVerdict(item: ActivityItemRow, input: InterruptionInput): InterruptionReason {
  const { prefs, mutes, now } = input;
  if (isStale(item, now)) return 'STALE';
  if (item.attention !== 'NEW') return 'ALREADY_SEEN';
  if (item.interruption_settled_at !== null) return 'SETTLED';
  const silence = silenceOf(item, prefs, mutes);
  if (silence !== null) return silence;
  // Task Contract §7: Allow and Reduce both need the real Proactive Gate's verdict. It does not exist, so proactive
  // interruption fails closed — no score, class rule or threshold stands in for it. The item stays in Activity.
  if (item.kind === 'PROACTIVE' && (input.gate ?? PROACTIVE_GATE) === 'ABSENT') return 'PROACTIVE_GATE_ABSENT';
  if (item.interruption_class >= 4) return 'AMBIENT';
  if (item.kind === 'PUBLIC_DISCOVERY') return 'DISCOVERY_NO_STRIP';
  if (!isCallSafe(item)) {
    if (isSnoozed(prefs, now)) return 'SNOOZED';
    if (inQuietHours(prefs.quietHours, localMinute(now, input.timeZone))) return 'QUIET_HOURS';
  }
  const occurred = Date.parse(item.last_occurred_at);
  if (!Number.isFinite(occurred) || now - occurred > INTERRUPTION_FRESHNESS_MS) return 'NOT_FRESH';
  return 'ELIGIBLE';
}

/** The disclosure subject of an item (D15). */
export function lockSubjectOf(item: Pick<ActivityItemRow, 'category' | 'kind'>): LockSubject {
  switch (item.kind) {
    case 'REMINDER': return 'REMINDERS';
    case 'PUBLIC_DISCOVERY': return 'DISCOVERY';
    case 'SECURITY': return 'SECURITY';
    case 'ACCOUNT': return 'ACCOUNT';
    case 'PROACTIVE': return 'QANDEEL';
    case 'SHARED_ACTIVITY': return 'SHARED';
    case 'PUBLIC_INTERACTION': return 'PUBLIC';
    case 'INTRODUCTION': return 'INTRODUCTIONS';
  }
}

/** D14 / D17 — the lower ceiling wins: the user's ceiling and the event's own bounded projection. Importance never raises it. */
export function disclosureLevel(item: Pick<ActivityItemRow, 'category' | 'kind' | 'disclosure_max'>, prefs: ActivityPreferences): DisclosureLevel {
  const ceiling = prefs.lock[lockSubjectOf(item)];
  return DISCLOSURE_LEVELS.indexOf(item.disclosure_max) <= DISCLOSURE_LEVELS.indexOf(ceiling) ? item.disclosure_max : ceiling;
}

export const isExecutable = (item: Pick<ActivityItemRow, 'entry_destination'>): boolean => EXECUTABLE_DESTINATIONS.has(item.entry_destination);

// ---------------------------------------------------------------------------------------------------------------------
// Platform delivery (consumed by A3-02). No transport, token or provider exists here: this is the provider-neutral
// Product verdict A3-02 must ask before any platform delivery, over per-user delivery EVIDENCE it records.
// ---------------------------------------------------------------------------------------------------------------------

/** P3 §14 — the v1 safety ceilings. Ceilings, never quotas: nothing here ever creates a send. */
export const CEILINGS = Object.freeze({
  ordinary: { per24h: 4, per7d: 12 },
  proactive: { per24h: 1, per7d: 3, sameThreadHours: 48 },
  discovery: { per7d: 1 },
});

/** One platform interruption that truly happened (A3-02 records it per user; never inferred — D41, D56). */
export interface DeliveryEvidence {
  readonly at: number;
  readonly kind: ActivityItemRow['kind'];
  readonly critical: boolean;
  readonly requested: boolean;
  readonly thread?: string | null;
  readonly engaged?: boolean;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ordinary = (e: Pick<DeliveryEvidence, 'kind' | 'critical' | 'requested'>) => !isCallSafe(e);
const within = (evidence: readonly DeliveryEvidence[], now: number, span: number, keep: (e: DeliveryEvidence) => boolean) =>
  evidence.filter((e) => e.at > now - span && e.at <= now && keep(e)).length;

export type BudgetReason = 'ordinary-24h' | 'ordinary-7d' | 'proactive-24h' | 'proactive-7d' | 'same-thread-48h' | 'discovery-7d';

/** P3 §14, counted over actual delivery evidence of the channel — never over raw source events. */
export function budgetVerdict(
  candidate: { readonly kind: ActivityItemRow['kind']; readonly critical: boolean; readonly requested: boolean; readonly thread?: string | null },
  evidence: readonly DeliveryEvidence[], now: number,
): { readonly ok: true; readonly outside: boolean } | { readonly ok: false; readonly reason: BudgetReason } {
  if (!ordinary(candidate)) return { ok: true, outside: true };
  if (within(evidence, now, DAY, ordinary) >= CEILINGS.ordinary.per24h) return { ok: false, reason: 'ordinary-24h' };
  if (within(evidence, now, 7 * DAY, ordinary) >= CEILINGS.ordinary.per7d) return { ok: false, reason: 'ordinary-7d' };
  if (candidate.kind === 'PROACTIVE') {
    const proactive = (e: DeliveryEvidence) => e.kind === 'PROACTIVE';
    if (within(evidence, now, DAY, proactive) >= CEILINGS.proactive.per24h) return { ok: false, reason: 'proactive-24h' };
    if (within(evidence, now, 7 * DAY, proactive) >= CEILINGS.proactive.per7d) return { ok: false, reason: 'proactive-7d' };
    const thread = candidate.thread ?? null;
    if (thread !== null) {
      const prior = evidence.filter((e) => e.kind === 'PROACTIVE' && e.thread === thread).sort((a, b) => a.at - b.at);
      const last = prior[prior.length - 1];
      if (last !== undefined && !last.engaged && now - last.at < CEILINGS.proactive.sameThreadHours * HOUR) return { ok: false, reason: 'same-thread-48h' };
    }
  }
  if (candidate.kind === 'PUBLIC_DISCOVERY' && within(evidence, now, 7 * DAY, (e) => e.kind === 'PUBLIC_DISCOVERY') >= CEILINGS.discovery.per7d) {
    return { ok: false, reason: 'discovery-7d' };
  }
  return { ok: true, outside: false };
}

export type PlatformVerdict =
  | { readonly deliver: true; readonly level: DisclosureLevel }
  | { readonly deliver: false; readonly reason: InterruptionReason | BudgetReason | 'OS_PERMISSION' | 'IN_PRODUCT_ATTENTION' | 'ONE_AT_A_TIME' };

export interface PlatformInput extends InterruptionInput {
  readonly evidence: readonly DeliveryEvidence[];
  /** D50: the OS permission is a hard boundary; A3-02 owns reading it. */
  readonly osPermission: 'GRANTED' | 'DENIED' | 'NOT_REQUESTED';
  /** D51: the Product already has the user's attention (foreground) — no duplicate external interruption. */
  readonly foreground: boolean;
}

/**
 * The provider-neutral platform verdict for ONE item (A3-02 consumes it; nothing in A3-01 delivers). Discovery may use
 * the platform channel only when opted in (it is already silenced otherwise); every other rule is interruptionVerdict's.
 */
export function platformVerdict(item: ActivityItemRow, input: PlatformInput): PlatformVerdict {
  if (input.foreground) return { deliver: false, reason: 'IN_PRODUCT_ATTENTION' };
  const reason = interruptionVerdict(item, input);
  if (reason !== 'ELIGIBLE' && reason !== 'DISCOVERY_NO_STRIP') return { deliver: false, reason };
  if (input.osPermission !== 'GRANTED') return { deliver: false, reason: 'OS_PERMISSION' };
  const budget = budgetVerdict(item, input.evidence, input.now);
  if (!budget.ok) return { deliver: false, reason: budget.reason };
  return { deliver: true, level: disclosureLevel(item, input.prefs) };
}

/**
 * P3 §8 / §13 — re-evaluation, never a flush. When a deferring condition ends (Quiet Hours or Snooze end, a call ends,
 * the user leaves the Analysis), every waiting item is decided AGAIN against current truth, and AT MOST ONE may
 * interrupt; the others are settled as Activity items. Nothing is presented merely because it waited.
 *
 * Which one: P3 §8 leaves the tie-break to I-08N-01 D11 (value-driven, ranking not frozen). Implementation choice, not
 * Product law: the lowest Interruption Class, then the most recent occurrence (freshness, a D11 factor).
 */
export function chooseOne<T extends { readonly interruption_class: number; readonly last_occurred_at: string; readonly id: string }>(eligible: readonly T[]): {
  readonly chosen: T | null; readonly settled: readonly T[];
} {
  const ordered = [...eligible].sort((a, b) =>
    a.interruption_class - b.interruption_class || Date.parse(b.last_occurred_at) - Date.parse(a.last_occurred_at) || a.id.localeCompare(b.id));
  return { chosen: ordered[0] ?? null, settled: ordered.slice(1) };
}
