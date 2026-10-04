import { Injectable } from '@nestjs/common';
import { ActivityRepository } from './activity.repository';
import {
  CATEGORY_CONTEXT, CONTEXT_DESTINATIONS, DISCLOSURE_LEVELS, KIND_CATEGORY, SETTINGS_SECTIONS, type ActivityKind,
  type DisclosureLevel, type EntryDestination, type InterruptionClass,
} from './activity.types';

/**
 * A3-01 — the ONE typed Product notification candidate (I-08N-01 §19, Task Contract §6.1). A source domain publishes a
 * candidate only after its OWN eligibility gate has passed (D23 "eligible reason ≠ automatic trigger"); this boundary
 * then projects it into the recipient's Activity. It carries only Product facts the frozen contracts name: no
 * provider payload, score, weight, threshold, urgency or "importance" field exists, by construction.
 */
export interface ActivityCandidate {
  /** The recipient. Exactly one: fan-out is the source domain's own bounded concern. */
  readonly recipientUserId: string;
  /** D57: the stable identity of THIS delivery intent; a replay is a no-op. */
  readonly candidateKey: string;
  /** An opaque reference back to the source event the source domain owns (Activity is never the event store, D29). */
  readonly sourceRef: string;
  readonly kind: ActivityKind;
  /** D10, the producer's own fact. Class 1 is reserved to critical security. */
  readonly interruptionClass: InterruptionClass;
  /** D36: a genuinely critical security / account event (SECURITY only). */
  readonly critical?: boolean;
  /** D06: an exact-time reminder the user explicitly requested (REMINDER only). */
  readonly requested?: boolean;
  /** The originating context reference (required for a Shared World; opaque). */
  readonly contextRef?: string | null;
  readonly contextLabel?: { readonly ar?: string; readonly en?: string } | null;
  /** D38–D43: one destination inside the item's own authority scope. */
  readonly entry: { readonly destination: EntryDestination; readonly ref?: string | null };
  /** D18: QANDEEL speaks only where QANDEEL genuinely initiates. */
  readonly speaker: 'QANDEEL' | 'PRODUCT';
  /** D21: the bounded, already-authorized in-app sentence, in the languages the producer rendered. */
  readonly body: { readonly ar?: string; readonly en?: string };
  readonly secondary?: { readonly ar?: string; readonly en?: string } | null;
  /** P3 §4: the item still needs the user after being seen. */
  readonly actionable?: boolean;
  /** D14 / D17: what this ONE event's bounded safe projection may carry outside the Product. */
  readonly disclosureMax: DisclosureLevel;
  readonly occurredAt: string;
  /** D59: the end of the interruption's semantic timing window, when the source knows one. */
  readonly expiresAt?: string | null;
}

export type PublishOutcome = 'PUBLISHED' | 'COALESCED' | 'DUPLICATE';

export class ActivityCandidateInvalidError extends Error {
  constructor(readonly field: string) { super(`Activity candidate refused: ${field}.`); }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const bounded = (value: unknown, max: number): value is string => typeof value === 'string' && value.length >= 1 && value.length <= max;
const optional = (value: unknown, max: number, field: string): string | null => {
  if (value === undefined || value === null) return null;
  if (!bounded(value, max)) throw new ActivityCandidateInvalidError(field);
  return value;
};

/** Validates a candidate against the frozen vocabulary. The database checks every rule again (0136). */
export function validateCandidate(candidate: ActivityCandidate): void {
  const fail = (field: string): never => { throw new ActivityCandidateInvalidError(field); };
  if (!UUID.test(candidate.recipientUserId)) fail('recipientUserId');
  if (!bounded(candidate.candidateKey, 200)) fail('candidateKey');
  if (!bounded(candidate.sourceRef, 200)) fail('sourceRef');
  const category = KIND_CATEGORY[candidate.kind] ?? fail('kind');
  if (![1, 2, 3, 4].includes(candidate.interruptionClass)) fail('interruptionClass');
  if (candidate.interruptionClass === 1 && !candidate.critical) fail('interruptionClass');
  if (candidate.critical && candidate.kind !== 'SECURITY') fail('critical');
  if (candidate.requested && candidate.kind !== 'REMINDER') fail('requested');
  const context = CATEGORY_CONTEXT[category];
  const contextRef = optional(candidate.contextRef, 200, 'contextRef');
  if (context === 'SHARED_WORLD' && contextRef === null) fail('contextRef');
  if ((context === 'PERSONAL' || context === 'ACCOUNT') && contextRef !== null) fail('contextRef');
  if (!CONTEXT_DESTINATIONS[context].includes(candidate.entry.destination)) fail('entry');
  const ref = optional(candidate.entry.ref, 200, 'entry');
  const destination = candidate.entry.destination;
  if (destination === 'GENERAL_SETTINGS' ? !(SETTINGS_SECTIONS as readonly string[]).includes(ref ?? '')
    : ['SHARED_WORLD', 'PUBLIC_WORLD', 'INTRODUCTIONS', 'REPLAY'].includes(destination) ? ref === null : ref !== null) fail('entry');
  if (candidate.speaker === 'QANDEEL' && category !== 'QANDEEL') fail('speaker');
  if (candidate.speaker !== 'QANDEEL' && candidate.speaker !== 'PRODUCT') fail('speaker');
  const ar = optional(candidate.body.ar, 280, 'body');
  const en = optional(candidate.body.en, 280, 'body');
  if (ar === null && en === null) fail('body');
  optional(candidate.secondary?.ar, 280, 'secondary');
  optional(candidate.secondary?.en, 280, 'secondary');
  optional(candidate.contextLabel?.ar, 120, 'contextLabel');
  optional(candidate.contextLabel?.en, 120, 'contextLabel');
  if (!(DISCLOSURE_LEVELS as readonly string[]).includes(candidate.disclosureMax)) fail('disclosureMax');
  const occurred = Date.parse(candidate.occurredAt);
  if (!Number.isFinite(occurred)) fail('occurredAt');
  if (candidate.expiresAt != null && !(Date.parse(candidate.expiresAt) > occurred)) fail('expiresAt');
}

/**
 * The publishing boundary every future source domain uses — Shared (Stage 4), Public (Stage 5), Introductions
 * (Stage 6), and the Proactive Gate, requested-reminder and Account & Security event producers named in the backlog.
 * No route reaches it, and nothing on `main` calls it: no source producer exists yet, so the production Activity feed is
 * truthfully empty (A3-01 record §3.2). It is not a delivery channel and it sends nothing.
 */
@Injectable()
export class ActivityPublisher {
  constructor(private readonly repository: ActivityRepository) {}

  async publish(candidate: ActivityCandidate): Promise<{ readonly outcome: PublishOutcome; readonly itemId: string }> {
    validateCandidate(candidate);
    const category = KIND_CATEGORY[candidate.kind];
    const rows = await this.repository.publish({
      p_user_id: candidate.recipientUserId, p_candidate_key: candidate.candidateKey, p_source_ref: candidate.sourceRef,
      p_category: category, p_kind: candidate.kind, p_interruption_class: candidate.interruptionClass,
      p_critical: candidate.critical === true, p_requested: candidate.requested === true,
      p_context_kind: CATEGORY_CONTEXT[category], p_context_ref: candidate.contextRef ?? null,
      p_context_label_ar: candidate.contextLabel?.ar ?? null, p_context_label_en: candidate.contextLabel?.en ?? null,
      p_entry_destination: candidate.entry.destination, p_entry_ref: candidate.entry.ref ?? null, p_speaker: candidate.speaker,
      p_body_ar: candidate.body.ar ?? null, p_body_en: candidate.body.en ?? null,
      p_secondary_ar: candidate.secondary?.ar ?? null, p_secondary_en: candidate.secondary?.en ?? null,
      p_actionable: candidate.actionable === true, p_disclosure_max: candidate.disclosureMax,
      p_occurred_at: candidate.occurredAt, p_expires_at: candidate.expiresAt ?? null,
    });
    const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
    if (row === null || !['PUBLISHED', 'COALESCED', 'DUPLICATE'].includes(row.outcome) || !UUID.test(row.item_id)) {
      throw new Error('ACTIVITY_PUBLISH_MALFORMED');
    }
    return { outcome: row.outcome as PublishOutcome, itemId: row.item_id };
  }

  /** A source domain withdrew / revoked a source event: its items read stale and never resurrect. */
  async withdraw(recipientUserId: string, sourceRef: string): Promise<number> {
    if (!UUID.test(recipientUserId) || !bounded(sourceRef, 200)) throw new ActivityCandidateInvalidError('withdraw');
    const rows = await this.repository.withdraw(recipientUserId, sourceRef);
    const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
    if (row === null || !Number.isSafeInteger(row.withdrawn_items)) throw new Error('ACTIVITY_WITHDRAW_MALFORMED');
    return row.withdrawn_items;
  }
}
