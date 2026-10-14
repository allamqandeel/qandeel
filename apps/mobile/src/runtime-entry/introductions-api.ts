/**
 * S6-01 — the client for «التعارف مع قنديل» / Introductions with QANDEEL: the owner's pre-enrollment preparation.
 *
 *   GET  /introductions/availability                    — presentation hints; enrollment is never available
 *   GET  /introductions/preparation                     — the owner's draft, authorized prior items and the objective plan
 *   POST /introductions/preparation/commands            — { commandId, expectedVersion, kind, payload }
 *   POST /introductions/preparation/discard             — { commandId }
 *   POST /introductions/preparation/assistance/grant    — { commandId, consentVersion }
 *   POST /introductions/preparation/assistance/revoke   — { commandId }
 *
 * A transport and nothing else: no credential of its own (the AC-01 request-time seam its caller hands it), no user id,
 * no retry, no meaning, no persistence. It decodes STRICTLY: an unknown objective, state or field is not an answer, so
 * nothing the Product does not name can reach the page — and no answer can say enrollment is available.
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

export type IntroductionsFact = 'INTRODUCTION_FIRST_NAME' | 'SEX' | 'BIRTH_YEAR_MONTH' | 'BROAD_AREA' | 'MARITAL_STATUS';
export type IntroductionsFactState = 'DECLARED' | 'CONFIRMED' | 'CORRECTED';
export type IntroductionsDimension = 'AGE_RANGE' | 'MARITAL_STATUS' | 'AREA';
export type IntroductionsPriorClass = 'PERSONAL_FACT' | 'STABLE_PREFERENCE' | 'GOAL' | 'DECISION_COMMITMENT';
export type IntroductionsSkipStep = 'NOTES' | 'SHORT_INTRODUCTION' | 'WORK_FIELD' | 'ASSISTANCE_OFFER' | 'PRIOR_UNDERSTANDING';
export type IntroductionsCommandKind = 'SET_FACT' | 'CONFIRM_FACT' | 'SET_PROFILE' | 'SET_REQUIREMENTS' | 'ADD_NOTE' | 'REMOVE_NOTE'
  | 'RECORD_PRIOR_UNDERSTANDING' | 'SKIP_STEP' | 'CONFIRM_REVIEW';
export type IntroductionsCommandOutcome = 'APPLIED' | 'UNAVAILABLE' | 'ACCOUNT_DELETION_PENDING' | 'STALE_VERSION' | 'COMMAND_ID_REUSED'
  | 'NOT_ELIGIBLE' | 'ALREADY_DECIDED' | 'NOTE_LIMIT_REACHED' | 'NOTHING_TO_CONFIRM' | 'NOT_READY_FOR_REVIEW';

export interface IntroductionsRequirementItem {
  readonly dimension: IntroductionsDimension;
  readonly min?: number;
  readonly max?: number;
  readonly accepted?: readonly string[];
  readonly countryCode?: string;
  readonly regionCodes?: readonly string[];
}
export interface IntroductionsPriorItem {
  readonly memoryId: string;
  readonly itemClass: IntroductionsPriorClass;
  /** The owner's own words, exactly as QANDEEL holds them. */
  readonly words: string;
  readonly recency: 'CURRENT' | 'NEEDS_RECHECK';
}
export type IntroductionsObjective =
  | { readonly kind: 'OFFER_ASSISTANCE' | 'ESTABLISH_HARD_REQUIREMENTS' | 'ESTABLISH_SOFT_PREFERENCES' | 'ESTABLISH_PRIORITIES'
      | 'OFFER_SHORT_INTRODUCTION' | 'OFFER_WORK_FIELD' | 'REVIEW' }
  | { readonly kind: 'RESOLVE_DISCREPANCY'; readonly dimensions: readonly IntroductionsDimension[] }
  | { readonly kind: 'RECONFIRM_CORRECTED_FACT' | 'ESTABLISH_FACT' | 'CONFIRM_DECLARED_FACT'; readonly fact: IntroductionsFact }
  | { readonly kind: 'CLARIFY_PRIOR_ITEM' | 'CONFIRM_PRIOR_ITEM'; readonly item: IntroductionsPriorItem };

export interface IntroductionsDraft {
  readonly version: number;
  readonly facts: {
    readonly firstName: { readonly value: string; readonly state: IntroductionsFactState } | null;
    readonly sex: { readonly value: 'MALE' | 'FEMALE'; readonly state: IntroductionsFactState } | null;
    readonly birthYearMonth: { readonly year: number; readonly month: number; readonly state: IntroductionsFactState } | null;
    readonly area: { readonly countryCode: string; readonly regionCode: string | null; readonly state: IntroductionsFactState } | null;
    readonly maritalStatus: { readonly value: string; readonly state: IntroductionsFactState } | null;
  };
  readonly profile: { readonly shortIntroduction: string | null; readonly workField: string | null };
  readonly requirements: {
    readonly hard: { readonly answer: 'NONE_ADDITIONAL' | 'ITEMS' | null; readonly items: readonly IntroductionsRequirementItem[] };
    readonly soft: { readonly answer: 'NONE' | 'ITEMS' | null; readonly items: readonly IntroductionsRequirementItem[] };
    readonly discrepancies: readonly IntroductionsDimension[];
  };
  readonly notes: readonly { readonly id: string; readonly kind: 'ABOUT_ME' | 'WHAT_MATTERS'; readonly origin: string; readonly body: string }[];
  readonly skippedSteps: readonly IntroductionsSkipStep[];
  readonly review: { readonly state: 'NOT_REVIEWED' | 'REVIEWED' | 'CHANGED_SINCE_REVIEW' };
}

export interface IntroductionsView {
  readonly availability: { readonly preparation: boolean; readonly assistance: boolean };
  readonly accountDeletionPending: boolean;
  readonly assistance: { readonly consent: 'GRANTED' | 'NOT_GRANTED'; readonly currentVersion: string | null };
  readonly draft: IntroductionsDraft | null;
  readonly priorItems: readonly IntroductionsPriorItem[];
  readonly plan: {
    readonly path: 'NEW' | 'KNOWN' | 'MIXED';
    readonly stage: 'NOT_STARTED' | 'PREPARING' | 'READY_FOR_REVIEW' | 'REVIEWED';
    readonly next: IntroductionsObjective | null;
  };
}
export interface IntroductionsAvailability {
  readonly preparation: boolean;
  readonly assistance: boolean;
  readonly hasDraft: boolean;
}

export type IntroductionsRead = { readonly kind: 'READ'; readonly view: IntroductionsView } | { readonly kind: 'UNAVAILABLE' };
export type IntroductionsAvailabilityRead = { readonly kind: 'READ'; readonly availability: IntroductionsAvailability } | { readonly kind: 'UNAVAILABLE' };
/** FAILED: the outcome is not known; asking again with the SAME command id is safe. INVALID: refused as a request. */
export type IntroductionsChange =
  | { readonly kind: 'ANSWERED'; readonly outcome: string; readonly view: IntroductionsView }
  | { readonly kind: 'INVALID' }
  | { readonly kind: 'FAILED' };

export interface IntroductionsApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const FACTS: readonly IntroductionsFact[] = ['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS'];
const STATES: readonly string[] = ['DECLARED', 'CONFIRMED', 'CORRECTED'];
const DIMENSIONS: readonly string[] = ['AGE_RANGE', 'MARITAL_STATUS', 'AREA'];
const SKIPS: readonly string[] = ['NOTES', 'SHORT_INTRODUCTION', 'WORK_FIELD', 'ASSISTANCE_OFFER', 'PRIOR_UNDERSTANDING'];
const PLAIN_OBJECTIVES: readonly string[] = ['OFFER_ASSISTANCE', 'ESTABLISH_HARD_REQUIREMENTS', 'ESTABLISH_SOFT_PREFERENCES',
  'ESTABLISH_PRIORITIES', 'OFFER_SHORT_INTRODUCTION', 'OFFER_WORK_FIELD', 'REVIEW'];
const FACT_OBJECTIVES: readonly string[] = ['RECONFIRM_CORRECTED_FACT', 'ESTABLISH_FACT', 'CONFIRM_DECLARED_FACT'];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const oneOf = (values: readonly string[], value: unknown): value is string => typeof value === 'string' && values.includes(value);

function decodePriorItem(value: unknown): IntroductionsPriorItem | null {
  if (!isRecord(value) || typeof value.memoryId !== 'string' || !UUID.test(value.memoryId) || typeof value.words !== 'string'
      || !oneOf(['PERSONAL_FACT', 'STABLE_PREFERENCE', 'GOAL', 'DECISION_COMMITMENT'], value.itemClass)
      || !oneOf(['CURRENT', 'NEEDS_RECHECK'], value.recency)) return null;
  return { memoryId: value.memoryId, itemClass: value.itemClass as IntroductionsPriorClass, words: value.words, recency: value.recency as 'CURRENT' | 'NEEDS_RECHECK' };
}

function decodeObjective(value: unknown): IntroductionsObjective | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.kind !== 'string') return undefined;
  if (PLAIN_OBJECTIVES.includes(value.kind)) return { kind: value.kind } as IntroductionsObjective;
  if (FACT_OBJECTIVES.includes(value.kind) && oneOf(FACTS, value.fact)) return { kind: value.kind, fact: value.fact } as IntroductionsObjective;
  if (value.kind === 'RESOLVE_DISCREPANCY' && Array.isArray(value.dimensions) && value.dimensions.every((d) => oneOf(DIMENSIONS, d))) {
    return { kind: 'RESOLVE_DISCREPANCY', dimensions: value.dimensions as IntroductionsDimension[] };
  }
  if ((value.kind === 'CLARIFY_PRIOR_ITEM' || value.kind === 'CONFIRM_PRIOR_ITEM')) {
    const item = decodePriorItem(value.item);
    return item === null ? undefined : { kind: value.kind, item };
  }
  return undefined;
}

const fact = (value: unknown, check: (v: Record<string, unknown>) => boolean) =>
  value === null ? null : isRecord(value) && oneOf(STATES, value.state) && check(value) ? value : undefined;

function decodeDraft(value: unknown): IntroductionsDraft | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.version !== 'number' || !isRecord(value.facts) || !isRecord(value.profile) || !isRecord(value.requirements)
      || !isRecord(value.review) || !Array.isArray(value.notes) || !Array.isArray(value.skippedSteps)) return undefined;
  const f = value.facts;
  const facts = {
    firstName: fact(f.firstName, (v) => typeof v.value === 'string'),
    sex: fact(f.sex, (v) => v.value === 'MALE' || v.value === 'FEMALE'),
    birthYearMonth: fact(f.birthYearMonth, (v) => typeof v.year === 'number' && typeof v.month === 'number'),
    area: fact(f.area, (v) => typeof v.countryCode === 'string' && (v.regionCode === null || typeof v.regionCode === 'string')),
    maritalStatus: fact(f.maritalStatus, (v) => typeof v.value === 'string'),
  };
  if (Object.values(facts).some((x) => x === undefined)) return undefined;
  const r = value.requirements;
  const side = (s: unknown, answers: readonly string[]) => (isRecord(s) && (s.answer === null || oneOf(answers, s.answer)) && Array.isArray(s.items)
    && s.items.every((i) => isRecord(i) && oneOf(DIMENSIONS, i.dimension)) ? s : undefined);
  const hard = side(r.hard, ['NONE_ADDITIONAL', 'ITEMS']);
  const soft = side(r.soft, ['NONE', 'ITEMS']);
  if (!hard || !soft || !Array.isArray(r.discrepancies) || !r.discrepancies.every((d) => oneOf(DIMENSIONS, d))) return undefined;
  if (!value.notes.every((n) => isRecord(n) && typeof n.id === 'string' && oneOf(['ABOUT_ME', 'WHAT_MATTERS'], n.kind) && typeof n.body === 'string' && typeof n.origin === 'string')) return undefined;
  if (!value.skippedSteps.every((s) => oneOf(SKIPS, s)) || !oneOf(['NOT_REVIEWED', 'REVIEWED', 'CHANGED_SINCE_REVIEW'], value.review.state)) return undefined;
  const profile = value.profile;
  if (!(profile.shortIntroduction === null || typeof profile.shortIntroduction === 'string') || !(profile.workField === null || typeof profile.workField === 'string')) return undefined;
  return {
    version: value.version,
    facts: facts as IntroductionsDraft['facts'],
    profile: { shortIntroduction: profile.shortIntroduction as string | null, workField: profile.workField as string | null },
    requirements: { hard: hard as IntroductionsDraft['requirements']['hard'], soft: soft as IntroductionsDraft['requirements']['soft'], discrepancies: r.discrepancies as IntroductionsDimension[] },
    notes: value.notes as IntroductionsDraft['notes'],
    skippedSteps: value.skippedSteps as IntroductionsSkipStep[],
    review: { state: value.review.state as IntroductionsDraft['review']['state'] },
  };
}

/** The decoded preparation view, or `null` when anything is doubtful — including any claim that enrollment is available. */
export function decodeIntroductionsView(body: unknown): IntroductionsView | null {
  if (!isRecord(body) || !isRecord(body.availability) || !isRecord(body.assistance) || !isRecord(body.plan) || !Array.isArray(body.priorItems)) return null;
  const a = body.availability;
  if (typeof a.preparation !== 'boolean' || typeof a.assistance !== 'boolean' || a.enrollment !== false) return null;
  if (typeof body.accountDeletionPending !== 'boolean' || !oneOf(['GRANTED', 'NOT_GRANTED'], body.assistance.consent)) return null;
  if (body.plan.enrollment !== 'UNAVAILABLE' || !oneOf(['NEW', 'KNOWN', 'MIXED'], body.plan.path)
      || !oneOf(['NOT_STARTED', 'PREPARING', 'READY_FOR_REVIEW', 'REVIEWED'], body.plan.stage) || body.phrasing !== 'UNBOUND') return null;
  const draft = decodeDraft(body.draft);
  const next = decodeObjective(body.plan.next);
  const items = body.priorItems.map(decodePriorItem);
  if (draft === undefined || next === undefined || items.some((i) => i === null)) return null;
  return {
    availability: { preparation: a.preparation, assistance: a.assistance },
    accountDeletionPending: body.accountDeletionPending,
    assistance: {
      consent: body.assistance.consent as 'GRANTED' | 'NOT_GRANTED',
      currentVersion: typeof body.assistance.currentVersion === 'string' ? body.assistance.currentVersion : null,
    },
    draft,
    priorItems: items as IntroductionsPriorItem[],
    plan: { path: body.plan.path as IntroductionsView['plan']['path'], stage: body.plan.stage as IntroductionsView['plan']['stage'], next },
  };
}

/** The signed-in Introductions preparation client. Built on the AC-01 seam bound to one identity. */
export class IntroductionsApiClient {
  constructor(private readonly config: IntroductionsApiConfig) {}

  async availability(): Promise<IntroductionsAvailabilityRead> {
    const { body } = await this.request('GET', '/introductions/availability');
    if (!isRecord(body) || typeof body.preparation !== 'boolean' || typeof body.assistance !== 'boolean' || body.enrollment !== false
        || typeof body.hasDraft !== 'boolean') return { kind: 'UNAVAILABLE' };
    return { kind: 'READ', availability: { preparation: body.preparation, assistance: body.assistance, hasDraft: body.hasDraft } };
  }

  async read(): Promise<IntroductionsRead> {
    const view = decodeIntroductionsView((await this.request('GET', '/introductions/preparation')).body);
    return view === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', view };
  }

  command(commandId: string, expectedVersion: number, kind: IntroductionsCommandKind, payload: Record<string, unknown>): Promise<IntroductionsChange> {
    return this.change('/introductions/preparation/commands', { commandId, expectedVersion, kind, payload });
  }

  discard(commandId: string): Promise<IntroductionsChange> {
    return this.change('/introductions/preparation/discard', { commandId });
  }

  grantAssistance(commandId: string, consentVersion: string): Promise<IntroductionsChange> {
    return this.change('/introductions/preparation/assistance/grant', { commandId, consentVersion });
  }

  revokeAssistance(commandId: string): Promise<IntroductionsChange> {
    return this.change('/introductions/preparation/assistance/revoke', { commandId });
  }

  private async change(path: string, payload: Record<string, unknown>): Promise<IntroductionsChange> {
    const { status, body } = await this.request('POST', path, payload);
    if (status === 400) return { kind: 'INVALID' };
    if (!isRecord(body) || typeof body.outcome !== 'string') return { kind: 'FAILED' };
    const view = decodeIntroductionsView(body.view);
    return view === null ? { kind: 'FAILED' } : { kind: 'ANSWERED', outcome: body.outcome, view };
  }

  /** The status and decoded JSON of an answer; `body` is `undefined` for anything but a 2xx. Never thrown. */
  private async request(method: string, path: string, payload?: unknown): Promise<{ readonly status: number; readonly body: unknown }> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      if (!response.ok) return { status: response.status, body: undefined };
      return { status: response.status, body: await response.json() };
    } catch {
      return { status: 0, body: undefined };
    }
  }
}
