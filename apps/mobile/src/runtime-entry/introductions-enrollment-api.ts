/**
 * S6-07 (CP3) — the client for the reader's own governed Matching enrollment (migration 0165) and the withdrawal of one
 * consent (CP3):
 *
 *   GET  /introductions/enrollment             — the view: availability (the ENROLLMENT gate AND the three current
 *                                                consent texts), the current text and version of each consent, the
 *                                                reader's own setup state and last act
 *   POST /introductions/enrollment             { commandId, kind, expectedDraftVersion, consents } — { outcome, view }
 *   POST /introductions/enrollment/revocation  { commandId, consent } — { outcome, view }
 *
 * A transport and nothing else: no credential of its own (the AC-01 request-time seam its caller hands it), no user id,
 * no profile field, no state, no retry, no persistence. The client sends only the act, the reviewed draft version it
 * confirms and the exact version of each consent the reader agreed to. It decodes STRICTLY: an extra field, an unknown
 * word or a doubtful text makes the answer unusable, and an unusable answer is never shown as if it were the server's.
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

export interface IntroductionsEnrollmentApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

export type EnrollmentConsentKind = 'participation' | 'contextGrant' | 'disclosureAuthority';
export type EnrollmentActKind = 'ENROLL' | 'CORRECTION' | 'RESUME' | 'RECONFIRM_CONSENT';
export type EnrollmentOutcome =
  | 'ENROLLED' | 'CORRECTED' | 'RESUMED' | 'RECONFIRMED' | 'NOT_AVAILABLE_NOW' | 'DELETION_PENDING' | 'CHANGED' | 'INCOMPLETE'
  | 'CONSENT_OUTDATED' | 'ALREADY_ENROLLED' | 'NOT_ENROLLED' | 'NOT_RESUMABLE' | 'NO_CHANGE' | 'COMMAND_CONFLICT';
export type EnrollmentRevocationOutcome = 'REVOKED' | 'NOT_ACTIVE' | 'CHANGED' | 'COMMAND_CONFLICT';

/** One consent's CURRENT text, exactly as the operator installed it, and the version an act must name to agree to it. */
export interface EnrollmentConsentText { readonly version: string; readonly textAr: string; readonly textEn: string }

export interface EnrollmentView {
  /** True only while the ENROLLMENT gate is open AND a current text of each consent exists. False in production. */
  readonly available: boolean;
  readonly accountDeletionPending: boolean;
  readonly consents: { readonly [K in EnrollmentConsentKind]: EnrollmentConsentText | null };
  readonly setup: {
    readonly participationState: 'OFF' | 'ACTIVE' | 'PAUSED';
    readonly pauseReason: 'USER_PAUSED' | 'ACTIVE_INTRODUCTION' | 'POST_INTRODUCTION' | 'POST_SUCCESS' | 'SYSTEM_POLICY' | null;
    readonly contextGrant: boolean;
    readonly disclosureAuthority: boolean;
    readonly matchable: boolean;
  };
  readonly enrollment: null | { readonly enrolledDraftVersion: number | null; readonly lastAct: EnrollmentActKind; readonly lastActAt: string };
}

export type EnrollmentRead = { readonly kind: 'READ'; readonly view: EnrollmentView } | { readonly kind: 'UNAVAILABLE' };
/** FAILED: no usable answer (offline, refused, malformed) — the same command id is retried for the same act. */
export type EnrollmentActResult = { readonly kind: 'ANSWERED'; readonly outcome: EnrollmentOutcome; readonly view: EnrollmentView } | { readonly kind: 'FAILED' };
export type EnrollmentRevocationResult =
  | { readonly kind: 'ANSWERED'; readonly outcome: EnrollmentRevocationOutcome; readonly view: EnrollmentView } | { readonly kind: 'FAILED' };

export const ENROLLMENT_CONSENT_KINDS: readonly EnrollmentConsentKind[] = Object.freeze(['participation', 'contextGrant', 'disclosureAuthority']);
const OUTCOMES: readonly EnrollmentOutcome[] = [
  'ENROLLED', 'CORRECTED', 'RESUMED', 'RECONFIRMED', 'NOT_AVAILABLE_NOW', 'DELETION_PENDING', 'CHANGED', 'INCOMPLETE',
  'CONSENT_OUTDATED', 'ALREADY_ENROLLED', 'NOT_ENROLLED', 'NOT_RESUMABLE', 'NO_CHANGE', 'COMMAND_CONFLICT',
];
const REVOCATION_OUTCOMES: readonly EnrollmentRevocationOutcome[] = ['REVOKED', 'NOT_ACTIVE', 'CHANGED', 'COMMAND_CONFLICT'];
const ACTS: readonly EnrollmentActKind[] = ['ENROLL', 'CORRECTION', 'RESUME', 'RECONFIRM_CONSENT'];
const STATES = ['OFF', 'ACTIVE', 'PAUSED'] as const;
const PAUSES = ['USER_PAUSED', 'ACTIVE_INTRODUCTION', 'POST_INTRODUCTION', 'POST_SUCCESS', 'SYSTEM_POLICY'] as const;
const CONSENT_VERSION = /^[A-Z][A-Z0-9_]{2,63}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const MAX_CONSENT_TEXT = 4000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};
const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && (values as readonly string[]).includes(value);
const textOk = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_CONSENT_TEXT;

function decodeConsent(value: unknown): EnrollmentConsentText | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !hasExactly(value, ['version', 'textAr', 'textEn'])) return undefined;
  const { version, textAr, textEn } = value;
  if (typeof version !== 'string' || !CONSENT_VERSION.test(version) || !textOk(textAr) || !textOk(textEn)) return undefined;
  return Object.freeze({ version, textAr, textEn });
}

/** The view, or `null` when anything is doubtful. */
export function decodeEnrollmentView(value: unknown): EnrollmentView | null {
  if (!isRecord(value) || !hasExactly(value, ['available', 'accountDeletionPending', 'consents', 'setup', 'enrollment'])) return null;
  const { available, accountDeletionPending, consents, setup, enrollment } = value;
  if (typeof available !== 'boolean' || typeof accountDeletionPending !== 'boolean') return null;
  if (!isRecord(consents) || !hasExactly(consents, [...ENROLLMENT_CONSENT_KINDS])) return null;
  const participation = decodeConsent(consents.participation);
  const contextGrant = decodeConsent(consents.contextGrant);
  const disclosureAuthority = decodeConsent(consents.disclosureAuthority);
  if (participation === undefined || contextGrant === undefined || disclosureAuthority === undefined) return null;
  // Available means every consent has a current text: a view that says otherwise is not believed.
  if (available && (participation === null || contextGrant === null || disclosureAuthority === null)) return null;
  if (!isRecord(setup) || !hasExactly(setup, ['participationState', 'pauseReason', 'contextGrant', 'disclosureAuthority', 'matchable'])) return null;
  if (!oneOf(STATES, setup.participationState) || !(setup.pauseReason === null || oneOf(PAUSES, setup.pauseReason))
      || typeof setup.contextGrant !== 'boolean' || typeof setup.disclosureAuthority !== 'boolean' || typeof setup.matchable !== 'boolean') return null;
  let last: EnrollmentView['enrollment'] = null;
  if (enrollment !== null) {
    if (!isRecord(enrollment) || !hasExactly(enrollment, ['enrolledDraftVersion', 'lastAct', 'lastActAt'])) return null;
    const { enrolledDraftVersion, lastAct, lastActAt } = enrollment;
    if (!(enrolledDraftVersion === null || (typeof enrolledDraftVersion === 'number' && Number.isSafeInteger(enrolledDraftVersion) && enrolledDraftVersion >= 1))
        || !oneOf(ACTS, lastAct) || typeof lastActAt !== 'string' || Number.isNaN(Date.parse(lastActAt))) return null;
    last = Object.freeze({ enrolledDraftVersion: enrolledDraftVersion as number | null, lastAct, lastActAt });
  }
  return Object.freeze({
    available,
    accountDeletionPending,
    consents: Object.freeze({ participation, contextGrant, disclosureAuthority }),
    setup: Object.freeze({
      participationState: setup.participationState, pauseReason: setup.pauseReason as EnrollmentView['setup']['pauseReason'],
      contextGrant: setup.contextGrant, disclosureAuthority: setup.disclosureAuthority, matchable: setup.matchable,
    }),
    enrollment: last,
  });
}

export class IntroductionsEnrollmentApiClient {
  constructor(private readonly config: IntroductionsEnrollmentApiConfig) {}

  async read(): Promise<EnrollmentRead> {
    const view = decodeEnrollmentView(await this.exchange('GET', '/introductions/enrollment'));
    return view === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', view };
  }

  /** One act, carrying exactly the consents it exercises (null for every other one). */
  async act(
    commandId: string, kind: EnrollmentActKind, expectedDraftVersion: number | null,
    consents: { readonly [K in EnrollmentConsentKind]: string | null },
  ): Promise<EnrollmentActResult> {
    if (!UUID.test(commandId)) return { kind: 'FAILED' };
    const answer = await this.exchange('POST', '/introductions/enrollment', {
      commandId, kind, expectedDraftVersion,
      consents: { participation: consents.participation, contextGrant: consents.contextGrant, disclosureAuthority: consents.disclosureAuthority },
    });
    if (!isRecord(answer) || !hasExactly(answer, ['outcome', 'view']) || !oneOf(OUTCOMES, answer.outcome)) return { kind: 'FAILED' };
    const view = decodeEnrollmentView(answer.view);
    return view === null ? { kind: 'FAILED' } : { kind: 'ANSWERED', outcome: answer.outcome, view };
  }

  /** Withdraw ONE consent; the other two are never named. */
  async revoke(commandId: string, consent: EnrollmentConsentKind): Promise<EnrollmentRevocationResult> {
    if (!UUID.test(commandId) || !oneOf(ENROLLMENT_CONSENT_KINDS, consent)) return { kind: 'FAILED' };
    const answer = await this.exchange('POST', '/introductions/enrollment/revocation', { commandId, consent });
    if (!isRecord(answer) || !hasExactly(answer, ['outcome', 'view']) || !oneOf(REVOCATION_OUTCOMES, answer.outcome)) return { kind: 'FAILED' };
    const view = decodeEnrollmentView(answer.view);
    return view === null ? { kind: 'FAILED' } : { kind: 'ANSWERED', outcome: answer.outcome, view };
  }

  /** The decoded JSON of a 2xx, or null for any other answer. Never thrown. */
  private async exchange(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<unknown> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      if (!response.ok) return null;
      return (await response.json()) as unknown;
    } catch {
      return null;
    }
  }
}
