import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { IntroductionsPreparationRepository } from './introductions-preparation.repository';
import {
  COMMAND_KINDS, COMMAND_OUTCOMES, DECLARED_FACTS, DISCARD_OUTCOMES, FACT_STATES, GRANT_OUTCOMES, MARITAL_STATUSES, NOTE_KINDS,
  NOTE_ORIGINS, PRIOR_DECISIONS, REQUIREMENT_DIMENSIONS, REVOKE_OUTCOMES, SEX_VALUES, SKIP_STEPS, WORK_FIELDS,
  type CommandKind, type CommandOutcome, type DraftView, type PreparationRecord, type PriorItem, type RequirementItem,
} from './introductions-preparation.types';
import { selectOnboardingObjectives, type ObjectivePlan } from './onboarding-objective-selector';
import { ONBOARDING_PHRASING_PORT, type OnboardingPhrasingPort } from './onboarding-phrasing.port';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const CONSENT_VERSION = /^[A-Z][A-Z0-9_]{2,63}$/u;
const MAX_TEXT = 1000;

export interface PreparationView extends PreparationRecord {
  readonly priorItems: readonly PriorItem[];
  readonly plan: ObjectivePlan;
  /** Stage 8A owns live phrasing; S6-01 binds none, and the client renders the approved deterministic copy. */
  readonly phrasing: 'UNBOUND';
}
export interface AvailabilityView {
  readonly preparation: boolean;
  readonly assistance: boolean;
  readonly enrollment: false;
  readonly hasDraft: boolean;
}

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const integrity = (): never => { throw new Error('INTRODUCTIONS_PREPARATION_INTEGRITY'); };
const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && (values as readonly string[]).includes(value);
const exactKeys = (value: unknown, keys: readonly string[]): Json => {
  if (!isRecord(value) || Object.keys(value).length !== keys.length || keys.some((key) => !(key in value))) invalid();
  return value as Json;
};
const text = (value: unknown): string => (typeof value === 'string' && value.length <= MAX_TEXT ? value : invalid());
const textOrNull = (value: unknown): string | null => (value === null ? null : text(value));
const uuid = (value: unknown): string => (typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : invalid());
const wholeNumber = (value: unknown, max: number): number => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max ? value : invalid());

/**
 * The payload of one draft command, checked for its exact shape. Values are checked again, completely, by the database,
 * which refuses anything these let through; nothing here decides a value the database would not.
 */
function payloadFor(kind: CommandKind, payload: unknown): Json {
  switch (kind) {
    case 'SET_FACT': {
      const fact = isRecord(payload) ? payload.fact : undefined;
      if (fact === 'INTRODUCTION_FIRST_NAME') { const p = exactKeys(payload, ['fact', 'firstName']); return { fact, firstName: text(p.firstName) }; }
      if (fact === 'SEX') { const p = exactKeys(payload, ['fact', 'sex']); return oneOf(SEX_VALUES, p.sex) ? { fact, sex: p.sex } : invalid(); }
      if (fact === 'BIRTH_YEAR_MONTH') { const p = exactKeys(payload, ['fact', 'year', 'month']); return { fact, year: wholeNumber(p.year, 9999), month: wholeNumber(p.month, 12) }; }
      if (fact === 'BROAD_AREA') { const p = exactKeys(payload, ['fact', 'countryCode', 'regionCode']); return { fact, countryCode: text(p.countryCode), regionCode: textOrNull(p.regionCode) }; }
      if (fact === 'MARITAL_STATUS') { const p = exactKeys(payload, ['fact', 'maritalStatus']); return oneOf(MARITAL_STATUSES, p.maritalStatus) ? { fact, maritalStatus: p.maritalStatus } : invalid(); }
      return invalid();
    }
    case 'CONFIRM_FACT': { const p = exactKeys(payload, ['fact']); return oneOf(DECLARED_FACTS, p.fact) ? { fact: p.fact } : invalid(); }
    case 'SET_PROFILE': {
      const p = exactKeys(payload, ['shortIntroduction', 'workField']);
      const workField = textOrNull(p.workField);
      if (workField !== null && !oneOf(WORK_FIELDS, workField)) invalid();
      return { shortIntroduction: textOrNull(p.shortIntroduction), workField };
    }
    case 'SET_REQUIREMENTS': {
      const p = exactKeys(payload, ['strength', 'answer', 'items']);
      if (!(p.strength === 'HARD' && oneOf(['NONE_ADDITIONAL', 'ITEMS'], p.answer)) && !(p.strength === 'SOFT' && oneOf(['NONE', 'ITEMS'], p.answer))) invalid();
      if (!Array.isArray(p.items) || p.items.length > 3 || !p.items.every((item) => isRecord(item) && oneOf(REQUIREMENT_DIMENSIONS, item.dimension))) invalid();
      return { strength: p.strength, answer: p.answer, items: p.items };
    }
    case 'ADD_NOTE': { const p = exactKeys(payload, ['kind', 'body']); return oneOf(NOTE_KINDS, p.kind) ? { kind: p.kind, body: text(p.body) } : invalid(); }
    case 'REMOVE_NOTE': { const p = exactKeys(payload, ['noteId']); return { noteId: uuid(p.noteId) }; }
    case 'RECORD_PRIOR_UNDERSTANDING': {
      const corrected = isRecord(payload) && payload.decision === 'CORRECTED';
      const p = exactKeys(payload, corrected ? ['memoryId', 'decision', 'correctedBody'] : ['memoryId', 'decision']);
      if (!oneOf(PRIOR_DECISIONS, p.decision)) invalid();
      return corrected ? { memoryId: uuid(p.memoryId), decision: p.decision, correctedBody: text(p.correctedBody) } : { memoryId: uuid(p.memoryId), decision: p.decision };
    }
    case 'SKIP_STEP': { const p = exactKeys(payload, ['step']); return oneOf(SKIP_STEPS, p.step) ? { step: p.step } : invalid(); }
    case 'CONFIRM_REVIEW': exactKeys(payload, []); return {};
    default: return invalid();
  }
}

/**
 * S6-01 — Introductions with QANDEEL: the owner's preparation (CW2-06A; migration 0154), as the API sees it.
 *
 *  * Every read and command runs under the caller's token; the database derives the human and enforces gates,
 *    versions, the consent and the deletion rule. The API adds the exact request shapes, strict decoding of every
 *    answer (a doubtful answer fails closed), the deterministic objective plan, and nothing else.
 *  * No content is logged. No model is called: the phrasing seam is UNBOUND (Stage 8A).
 *  * Nothing here reads or writes the I-07 Matching runtime: preparation is never enrollment.
 */
@Injectable()
export class IntroductionsPreparationService {
  constructor(
    private readonly repository: IntroductionsPreparationRepository,
    @Inject(ONBOARDING_PHRASING_PORT) private readonly phrasing: OnboardingPhrasingPort,
  ) {}

  async availability(token: string): Promise<AvailabilityView> {
    return this.guard(async () => {
      const rows = await this.repository.availability(token);
      const row = Array.isArray(rows) && rows.length === 1 && isRecord(rows[0]) ? rows[0] : integrity();
      if (typeof row.preparation_available !== 'boolean' || typeof row.assistance_available !== 'boolean'
          || row.enrollment_available !== false || typeof row.has_draft !== 'boolean') integrity();
      return { preparation: row.preparation_available as boolean, assistance: row.assistance_available as boolean, enrollment: false, hasDraft: row.has_draft as boolean };
    });
  }

  async view(token: string): Promise<PreparationView> {
    return this.guard(async () => {
      const record = decodeRecord(await this.repository.read(token));
      // The reader is asked only when it could answer; the database re-checks the gates and the consent itself.
      const priorItems = record.availability.assistance && record.assistance.consent === 'GRANTED'
        ? decodePriorItems(await this.repository.priorItems(token)) : [];
      const plan = selectOnboardingObjectives(record, priorItems);
      const phrasing = plan.next === null ? 'UNBOUND' : this.phrasing.phrase(plan.next, plan.path).binding;
      return { ...record, priorItems, plan, phrasing };
    });
  }

  async command(token: string, body: unknown): Promise<{ readonly outcome: CommandOutcome; readonly view: PreparationView }> {
    const b = exactKeys(body, ['commandId', 'expectedVersion', 'kind', 'payload']);
    const commandId = uuid(b.commandId);
    const expectedVersion = wholeNumber(b.expectedVersion, Number.MAX_SAFE_INTEGER);
    const kind = oneOf(COMMAND_KINDS, b.kind) ? b.kind : invalid();
    const payload = payloadFor(kind, b.payload);
    const outcome = await this.guard(async () => outcomeOf(await this.repository.command(token, commandId, expectedVersion, kind, payload), COMMAND_OUTCOMES));
    return { outcome, view: await this.view(token) };
  }

  async discard(token: string, body: unknown) {
    const commandId = uuid(exactKeys(body, ['commandId']).commandId);
    const outcome = await this.guard(async () => outcomeOf(await this.repository.discard(token, commandId), DISCARD_OUTCOMES));
    return { outcome, view: await this.view(token) };
  }

  async grantAssistance(token: string, body: unknown) {
    const b = exactKeys(body, ['commandId', 'consentVersion']);
    const commandId = uuid(b.commandId);
    const consentVersion = typeof b.consentVersion === 'string' && CONSENT_VERSION.test(b.consentVersion) ? b.consentVersion : invalid();
    const outcome = await this.guard(async () => outcomeOf(await this.repository.grantAssistance(token, commandId, consentVersion), GRANT_OUTCOMES));
    return { outcome, view: await this.view(token) };
  }

  async revokeAssistance(token: string, body: unknown) {
    const commandId = uuid(exactKeys(body, ['commandId']).commandId);
    const outcome = await this.guard(async () => outcomeOf(await this.repository.revokeAssistance(token, commandId), REVOKE_OUTCOMES));
    return { outcome, view: await this.view(token) };
  }

  // A refusal the caller may see stays a 400 (including the database's own 22023). Everything else — an upstream
  // failure, a malformed answer — fails closed as one sanitized 503 that names nothing internal.
  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof DataApiError && error.status === 400) throw new BadRequestException({ outcome: 'INVALID_REQUEST' });
      throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
    }
  }
}

function outcomeOf<T extends string>(answer: unknown, allowed: readonly T[]): T {
  const outcome = isRecord(answer) ? answer.outcome : undefined;
  return oneOf(allowed, outcome) ? outcome : integrity();
}

const factOf = <T extends string>(value: unknown, values: readonly T[] | null) => {
  if (value === null) return null;
  if (!isRecord(value) || !oneOf(FACT_STATES, value.state)) return integrity();
  if (values === null ? typeof value.value !== 'string' : !oneOf(values, value.value)) return integrity();
  return { value: value.value as T, state: value.state };
};
const requirementItems = (value: unknown): RequirementItem[] =>
  (Array.isArray(value) && value.length <= 3 && value.every((i) => isRecord(i) && oneOf(REQUIREMENT_DIMENSIONS, i.dimension)) ? value as RequirementItem[] : integrity());

export function decodeRecord(answer: unknown): PreparationRecord {
  const r = isRecord(answer) ? answer : integrity();
  const availability = isRecord(r.availability) ? r.availability : integrity();
  const assistance = isRecord(r.assistance) ? r.assistance : integrity();
  if (typeof availability.preparation !== 'boolean' || typeof availability.assistance !== 'boolean' || availability.enrollment !== false
      || typeof r.accountDeletionPending !== 'boolean' || !oneOf(['GRANTED', 'NOT_GRANTED'], assistance.consent)) integrity();
  let draft: DraftView | null = null;
  if (r.draft !== null) {
    const d = isRecord(r.draft) ? r.draft : integrity();
    const facts = isRecord(d.facts) ? d.facts : integrity();
    const profile = isRecord(d.profile) ? d.profile : integrity();
    const requirements = isRecord(d.requirements) ? d.requirements : integrity();
    const hard = isRecord(requirements.hard) ? requirements.hard : integrity();
    const soft = isRecord(requirements.soft) ? requirements.soft : integrity();
    const review = isRecord(d.review) ? d.review : integrity();
    const birth = facts.birthYearMonth;
    const area = facts.area;
    if (typeof d.version !== 'number' || !Array.isArray(d.notes) || !Array.isArray(d.skippedSteps) || typeof d.priorUnderstandingDecisions !== 'number'
        || !Array.isArray(requirements.discrepancies) || !oneOf(['NOT_REVIEWED', 'REVIEWED', 'CHANGED_SINCE_REVIEW'], review.state)) integrity();
    draft = {
      version: d.version as number,
      facts: {
        firstName: factOf(facts.firstName, null),
        sex: factOf(facts.sex, SEX_VALUES),
        birthYearMonth: birth === null ? null : (isRecord(birth) && typeof birth.year === 'number' && typeof birth.month === 'number' && oneOf(FACT_STATES, birth.state)
          ? { year: birth.year, month: birth.month, state: birth.state } : integrity()),
        area: area === null ? null : (isRecord(area) && typeof area.countryCode === 'string' && (area.regionCode === null || typeof area.regionCode === 'string') && oneOf(FACT_STATES, area.state)
          ? { countryCode: area.countryCode, regionCode: area.regionCode as string | null, state: area.state } : integrity()),
        maritalStatus: factOf(facts.maritalStatus, MARITAL_STATUSES),
      },
      profile: {
        shortIntroduction: profile.shortIntroduction === null || typeof profile.shortIntroduction === 'string' ? profile.shortIntroduction as string | null : integrity(),
        workField: profile.workField === null || oneOf(WORK_FIELDS, profile.workField) ? profile.workField as string | null : integrity(),
      },
      requirements: {
        hard: { answer: hard.answer === null || oneOf(['NONE_ADDITIONAL', 'ITEMS'], hard.answer) ? hard.answer as 'NONE_ADDITIONAL' | 'ITEMS' | null : integrity(), items: requirementItems(hard.items) },
        soft: { answer: soft.answer === null || oneOf(['NONE', 'ITEMS'], soft.answer) ? soft.answer as 'NONE' | 'ITEMS' | null : integrity(), items: requirementItems(soft.items) },
        discrepancies: (requirements.discrepancies as unknown[]).map((x) => (oneOf(REQUIREMENT_DIMENSIONS, x) ? x : integrity())),
      },
      notes: (d.notes as unknown[]).map((n) => (isRecord(n) && typeof n.id === 'string' && UUID.test(n.id) && oneOf(NOTE_KINDS, n.kind) && oneOf(NOTE_ORIGINS, n.origin) && typeof n.body === 'string'
        ? { id: n.id, kind: n.kind, origin: n.origin, body: n.body } : integrity())),
      priorUnderstandingDecisions: d.priorUnderstandingDecisions as number,
      skippedSteps: (d.skippedSteps as unknown[]).map((s) => (oneOf(SKIP_STEPS, s) ? s : integrity())),
      review: { state: review.state as DraftView['review']['state'], reviewedVersion: typeof review.reviewedVersion === 'number' ? review.reviewedVersion : null },
    };
  }
  return {
    availability: { preparation: availability.preparation as boolean, assistance: availability.assistance as boolean, enrollment: false },
    accountDeletionPending: r.accountDeletionPending as boolean,
    assistance: {
      consent: assistance.consent as 'GRANTED' | 'NOT_GRANTED',
      grantedVersion: typeof assistance.grantedVersion === 'string' ? assistance.grantedVersion : null,
      currentVersion: typeof assistance.currentVersion === 'string' ? assistance.currentVersion : null,
    },
    draft,
  };
}

export function decodePriorItems(answer: unknown): PriorItem[] {
  if (!Array.isArray(answer) || answer.length > 12) return integrity();
  return answer.map((row) => {
    if (!isRecord(row) || typeof row.memory_id !== 'string' || !UUID.test(row.memory_id) || typeof row.content !== 'string'
        || !oneOf(['PERSONAL_FACT', 'STABLE_PREFERENCE', 'GOAL', 'DECISION_COMMITMENT'], row.memory_type)
        || !oneOf(['CURRENT', 'NEEDS_RECHECK'], row.recency)) return integrity();
    return { memoryId: row.memory_id, itemClass: row.memory_type, words: row.content, recency: row.recency };
  });
}
