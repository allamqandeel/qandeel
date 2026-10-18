import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError, readDataApiUpstreamIdentity } from '../conversation/supabase-data-api.service';
import { IntroductionsEnrollmentRepository, type EnrollmentKind } from './introductions-enrollment.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const CONSENT_VERSION = /^[A-Z][A-Z0-9_]{2,63}$/u;
const MAX_CONSENT_TEXT = 4000;

export const ENROLLMENT_KINDS: readonly EnrollmentKind[] = ['ENROLL', 'CORRECTION', 'RESUME', 'RECONFIRM_CONSENT'];
/** Every answer migration 0165 can give, and nothing else: an unknown word fails closed. */
export const ENROLLMENT_OUTCOMES = [
  'ENROLLED', 'CORRECTED', 'RESUMED', 'RECONFIRMED', 'NOT_AVAILABLE_NOW', 'DELETION_PENDING', 'CHANGED', 'INCOMPLETE',
  'CONSENT_OUTDATED', 'ALREADY_ENROLLED', 'NOT_ENROLLED', 'NOT_RESUMABLE', 'NO_CHANGE', 'COMMAND_CONFLICT',
] as const;
export type EnrollmentOutcome = typeof ENROLLMENT_OUTCOMES[number];
const PARTICIPATION_STATES = ['OFF', 'ACTIVE', 'PAUSED'] as const;
const PAUSE_REASONS = ['USER_PAUSED', 'ACTIVE_INTRODUCTION', 'POST_INTRODUCTION', 'POST_SUCCESS', 'SYSTEM_POLICY'] as const;

export interface ConsentText { readonly version: string; readonly textAr: string; readonly textEn: string }
export interface EnrollmentView {
  /** True only while the ENROLLMENT gate is open AND a current text of each of the three consents exists. */
  readonly available: boolean;
  readonly accountDeletionPending: boolean;
  readonly consents: {
    readonly participation: ConsentText | null;
    readonly contextGrant: ConsentText | null;
    readonly disclosureAuthority: ConsentText | null;
  };
  readonly setup: {
    readonly participationState: typeof PARTICIPATION_STATES[number];
    readonly pauseReason: typeof PAUSE_REASONS[number] | null;
    readonly contextGrant: boolean;
    readonly disclosureAuthority: boolean;
    readonly matchable: boolean;
  };
  readonly enrollment: null | {
    readonly enrolledDraftVersion: number | null;
    readonly lastAct: EnrollmentKind;
    readonly lastActAt: string;
  };
}
export interface EnrollmentActAnswer { readonly outcome: EnrollmentOutcome; readonly view: EnrollmentView }

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const integrity = (): never => { throw new Error('INTRODUCTIONS_ENROLLMENT_INTEGRITY'); };
const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value);
const exactKeys = (value: unknown, keys: readonly string[]): Json => {
  if (!isRecord(value) || Object.keys(value).length !== keys.length || keys.some((key) => !(key in value))) invalid();
  return value as Json;
};
const consentVersion = (value: unknown): string | null =>
  (value === null ? null : (typeof value === 'string' && CONSENT_VERSION.test(value) ? value : invalid()));

function consentTextOf(value: unknown): ConsentText | null {
  if (value === null) return null;
  const v = isRecord(value) ? value : integrity();
  if (Object.keys(v).length !== 3 || typeof v.version !== 'string' || !CONSENT_VERSION.test(v.version)
      || typeof v.textAr !== 'string' || typeof v.textEn !== 'string'
      || v.textAr.length === 0 || v.textAr.length > MAX_CONSENT_TEXT || v.textEn.length === 0 || v.textEn.length > MAX_CONSENT_TEXT) integrity();
  return { version: v.version as string, textAr: v.textAr as string, textEn: v.textEn as string };
}

/** Strict decoding of the 0165 read: a doubtful answer fails closed. */
export function decodeEnrollmentView(answer: unknown): EnrollmentView {
  const r = isRecord(answer) ? answer : integrity();
  const consents = isRecord(r.consents) ? r.consents : integrity();
  const setup = isRecord(r.setup) ? r.setup : integrity();
  if (typeof r.available !== 'boolean' || typeof r.accountDeletionPending !== 'boolean'
      || !oneOf(PARTICIPATION_STATES, setup.participationState)
      || !(setup.pauseReason === null || oneOf(PAUSE_REASONS, setup.pauseReason))
      || typeof setup.contextGrant !== 'boolean' || typeof setup.disclosureAuthority !== 'boolean' || typeof setup.matchable !== 'boolean') integrity();
  let enrollment: EnrollmentView['enrollment'] = null;
  if (r.enrollment !== null) {
    const e = isRecord(r.enrollment) ? r.enrollment : integrity();
    if (!(e.enrolledDraftVersion === null || (typeof e.enrolledDraftVersion === 'number' && Number.isSafeInteger(e.enrolledDraftVersion) && e.enrolledDraftVersion >= 1))
        || !oneOf(ENROLLMENT_KINDS, e.lastAct) || typeof e.lastActAt !== 'string' || Number.isNaN(Date.parse(e.lastActAt))) integrity();
    enrollment = { enrolledDraftVersion: e.enrolledDraftVersion as number | null, lastAct: e.lastAct as EnrollmentKind, lastActAt: e.lastActAt as string };
  }
  return {
    available: r.available as boolean,
    accountDeletionPending: r.accountDeletionPending as boolean,
    consents: {
      participation: consentTextOf(consents.participation ?? null),
      contextGrant: consentTextOf(consents.contextGrant ?? null),
      disclosureAuthority: consentTextOf(consents.disclosureAuthority ?? null),
    },
    setup: {
      participationState: setup.participationState as EnrollmentView['setup']['participationState'],
      pauseReason: setup.pauseReason as EnrollmentView['setup']['pauseReason'],
      contextGrant: setup.contextGrant as boolean,
      disclosureAuthority: setup.disclosureAuthority as boolean,
      matchable: setup.matchable as boolean,
    },
    enrollment,
  };
}

/**
 * S6-07 (CP1) — Governed Enrollment (migration 0165) as the API sees it.
 *
 *  * Every call runs under the caller's own token; the database derives the human, binds the closed-by-default
 *    ENROLLMENT gate, the deletion rule, the reviewed draft version and each exact consent version. The API adds the
 *    exact request shape and strict decoding of every answer, and nothing else: it decides no outcome itself.
 *  * The client sends no profile field, requirement, fact or account id - only the act, the reviewed draft version it
 *    confirms and the version of each consent it agrees to. No content is logged; no model is called.
 *  * Production is closed: no gate row and no consent text exist, so every act answers NOT_AVAILABLE_NOW.
 */
@Injectable()
export class IntroductionsEnrollmentService {
  constructor(private readonly repository: IntroductionsEnrollmentRepository) {}

  async read(token: string): Promise<EnrollmentView> {
    return this.guard(async () => decodeEnrollmentView(await this.repository.read(token)));
  }

  async act(token: string, body: unknown): Promise<EnrollmentActAnswer> {
    const b = exactKeys(body, ['commandId', 'kind', 'expectedDraftVersion', 'consents']);
    const commandId = typeof b.commandId === 'string' && UUID.test(b.commandId) ? b.commandId.toLowerCase() : invalid();
    const kind = oneOf(ENROLLMENT_KINDS, b.kind) ? b.kind : invalid();
    const expectedDraftVersion = b.expectedDraftVersion === null ? null
      : (typeof b.expectedDraftVersion === 'number' && Number.isSafeInteger(b.expectedDraftVersion) && b.expectedDraftVersion >= 1
        ? b.expectedDraftVersion : invalid());
    const c = exactKeys(b.consents, ['participation', 'contextGrant', 'disclosureAuthority']);
    const consents = {
      participation: consentVersion(c.participation),
      contextGrant: consentVersion(c.contextGrant),
      disclosureAuthority: consentVersion(c.disclosureAuthority),
    };
    const outcome = await this.guard(async () => {
      const rows = await this.repository.act(token, commandId, kind, expectedDraftVersion, consents);
      const row = Array.isArray(rows) && rows.length === 1 && isRecord(rows[0]) ? rows[0] : integrity();
      if (Object.keys(row).length !== 3 || !oneOf(ENROLLMENT_OUTCOMES, row.outcome)
          || !(row.participation_state === null || oneOf(PARTICIPATION_STATES, row.participation_state))
          || !(row.matchable === null || typeof row.matchable === 'boolean')) integrity();
      return row.outcome as EnrollmentOutcome;
    });
    return { outcome, view: await this.read(token) };
  }

  // A request the database refuses as malformed (22023) stays a 400. Everything else - an upstream failure, a malformed
  // answer - fails closed as one sanitized 503 that names nothing internal.
  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof DataApiError && error.status === 400 && readDataApiUpstreamIdentity(error).databaseCode === '22023') return invalid();
      throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
    }
  }
}
