/**
 * W1B-01 — the clients for the account routes.
 *
 *   GET  /account/first-use               — the caller's own Name and first-use state
 *   POST /account/first-use/welcome       — complete the caller's own Welcome step
 *   POST /account/login-id-availability   — may this Login ID still be chosen? (signed out)
 *
 * W3-02 adds the reader's own Public ID read and change; W3-MEGA-A the reader's own identity read, Name, Login ID,
 * Email and password changes and "sign out from other devices" (`/account/identity`, `/account/name/change`,
 * `/account/login-id/change`, `/account/email/change`, `/account/email/confirm`, `/account/password/change`,
 * `/account/sessions/sign-out-others`). W3-MEGA-S adds the reader's own Privacy & Data state, export request and
 * download, and account deletion request and cancellation (`/account/privacy`, `/account/privacy/export`,
 * `/account/privacy/export/download`, `/account/privacy/deletion`, `/account/privacy/deletion/cancel`).
 *
 * Transports and nothing else, exactly like the Conversation clients: they hold no credential (the
 * signed-in client goes through the AC-01 request-time seam its caller hands it; the availability
 * client carries none at all), they never repeat a request, and they never decide what an outcome
 * means to the reader. They decode strictly and report a typed outcome.
 */
import type { RuntimeHttpFetch } from '../conversation/conversation-session-api';

/** What the reader's first use and Conversation opening need to know, as the server decided it. */
export interface AccountFirstUseView {
  /** The account Name QANDEEL addresses the reader by, or null. No fallback is ever supplied. */
  readonly displayName: string | null;
  /** The one-time first-use Welcome is still owed. */
  readonly welcomePending: boolean;
  /** The First Conversation Opening, not the normal opener, is owed: no turn was ever committed. */
  readonly firstConversationOpening: boolean;
}

export type AccountFirstUseOutcome =
  | { readonly kind: 'READ'; readonly view: AccountFirstUseView }
  | { readonly kind: 'UNAVAILABLE' };

export type LoginIdAvailabilityOutcome =
  | { readonly kind: 'AVAILABLE' }
  | { readonly kind: 'TAKEN' }
  /** No HTTP answer at all: a genuine transport failure. */
  | { readonly kind: 'NETWORK' }
  /** The server answered, but not with a usable verdict. */
  | { readonly kind: 'FAILED' };

/** W3-02 — the reader's own Public ID, canonical and without the `@` the Product shows, and its allowance. */
export interface AccountPublicIdView {
  readonly publicId: string;
  /** The ONE lifetime manual change is still available. */
  readonly changeAvailable: boolean;
}

export type AccountPublicIdOutcome =
  | { readonly kind: 'READ'; readonly view: AccountPublicIdView }
  | { readonly kind: 'UNAVAILABLE' };

/** The server's bounded answers to the one lifetime change (migration 0125 decides each). */
export type PublicIdChangeAnswer = 'CHANGED' | 'UNCHANGED' | 'INVALID' | 'UNAVAILABLE' | 'ALREADY_USED';

export type PublicIdChangeOutcome =
  | { readonly kind: 'ANSWERED'; readonly answer: PublicIdChangeAnswer; readonly view: AccountPublicIdView }
  /** This command identity was already spent on another value. Nothing is known about this request. */
  | { readonly kind: 'CONFLICT' }
  /** The server answered, but not with a usable verdict. The change may or may not have committed. */
  | { readonly kind: 'FAILED' }
  /** No HTTP answer at all. The change may or may not have committed. */
  | { readonly kind: 'NETWORK' };

const PUBLIC_ID_ANSWERS: readonly string[] = Object.freeze(['CHANGED', 'UNCHANGED', 'INVALID', 'UNAVAILABLE', 'ALREADY_USED']);

/** W3-MEGA-A — the reader's own Name, Login ID and Email with its status, as the server read them. */
export interface AccountIdentityView {
  readonly name: string | null;
  readonly loginId: string | null;
  readonly email: string;
  readonly emailVerified: boolean;
}

export type AccountIdentityOutcome = { readonly kind: 'READ'; readonly view: AccountIdentityView } | { readonly kind: 'UNAVAILABLE' };

/**
 * W3-MEGA-A — the bounded answers of the owner routes (the database or the provider decides each). Every change also
 * has FAILED (answered, not usably) and NETWORK (no answer): whether it committed is then NOT known here.
 */
export type NameChangeOutcome =
  | { readonly kind: 'ANSWERED'; readonly answer: 'CHANGED' | 'UNCHANGED' | 'INVALID'; readonly name: string | null }
  | { readonly kind: 'FAILED' }
  | { readonly kind: 'NETWORK' };

export type LoginIdChangeOutcome =
  | { readonly kind: 'ANSWERED'; readonly answer: 'CHANGED' | 'UNCHANGED' | 'INVALID' | 'UNAVAILABLE'; readonly loginId: string }
  | { readonly kind: 'PASSWORD_REJECTED' }
  | { readonly kind: 'CONFLICT' }
  | { readonly kind: 'FAILED' }
  | { readonly kind: 'NETWORK' };

export type EmailChangeRequestOutcome =
  | { readonly kind: 'ACCEPTED' | 'UNCHANGED' | 'INVALID_EMAIL' | 'PASSWORD_REJECTED' }
  | { readonly kind: 'FAILED' }
  | { readonly kind: 'NETWORK' };

export type EmailChangeConfirmOutcome = { readonly kind: 'CHANGED' | 'CODE_REJECTED' } | { readonly kind: 'FAILED' } | { readonly kind: 'NETWORK' };

export type PasswordChangeOutcome =
  | { readonly kind: 'CHANGED' | 'CHANGED_SIGNED_OUT' | 'POLICY' | 'PASSWORD_REJECTED' }
  | { readonly kind: 'FAILED' }
  | { readonly kind: 'NETWORK' };

export type SignOutOthersOutcome = { readonly kind: 'SIGNED_OUT_OTHERS' } | { readonly kind: 'FAILED' } | { readonly kind: 'NETWORK' };

/**
 * W3-MEGA-S — the reader's own Privacy & Data state, as the server read it (migration 0130 decides each value):
 * the export package's state and, while it is READY, until when it can be downloaded; the account deletion's state
 * and, while SCHEDULED (or FINALIZING), when it becomes final.
 */
export type PrivacyExportStatus = 'NONE' | 'PREPARING' | 'READY' | 'EXPIRED' | 'FAILED';
export type PrivacyDeletionStatus = 'NONE' | 'SCHEDULED' | 'FINALIZING' | 'BLOCKED';

export interface PrivacyStateView {
  readonly export: { readonly status: PrivacyExportStatus; readonly availableUntil: string | null };
  readonly deletion: { readonly status: PrivacyDeletionStatus; readonly finalAt: string | null };
}

export type PrivacyStateOutcome = { readonly kind: 'READ'; readonly view: PrivacyStateView } | { readonly kind: 'UNAVAILABLE' };

/** A request that needs the password: held (with the resulting state), the password refused, or not known. */
export type PrivacyRequestOutcome =
  | { readonly kind: 'ACCEPTED'; readonly view: PrivacyStateView['export'] | PrivacyStateView['deletion'] }
  | { readonly kind: 'CANCELLED' }
  | { readonly kind: 'PASSWORD_REJECTED' }
  | { readonly kind: 'FAILED' }
  | { readonly kind: 'NETWORK' };

export type DeletionCancelOutcome =
  | { readonly kind: 'CANCELLED' | 'NONE' | 'NOT_CANCELLABLE' }
  | { readonly kind: 'FAILED' }
  | { readonly kind: 'NETWORK' };

/** The ready package, exactly as the server built it (a JSON document the reader saves), or its state alone. */
export type ExportDownloadOutcome =
  | { readonly kind: 'READY'; readonly availableUntil: string | null; readonly document: Record<string, unknown> }
  | { readonly kind: 'NOT_READY'; readonly status: PrivacyExportStatus }
  | { readonly kind: 'FAILED' }
  | { readonly kind: 'NETWORK' };

const EXPORT_STATUSES: readonly string[] = Object.freeze(['NONE', 'PREPARING', 'READY', 'EXPIRED', 'FAILED']);
const DELETION_STATUSES: readonly string[] = Object.freeze(['NONE', 'SCHEDULED', 'FINALIZING', 'BLOCKED']);
/** An instant the app can show: `null` stays null; a string that is not a readable date is refused, never drawn. */
const instantOrNull = (value: unknown): string | null | undefined =>
  value === null ? null : typeof value === 'string' && value !== '' && !Number.isNaN(Date.parse(value)) ? value : undefined;

function decodeExportPart(value: unknown): PrivacyStateView['export'] | null {
  if (!isRecord(value) || typeof value.status !== 'string' || !EXPORT_STATUSES.includes(value.status)) return null;
  const availableUntil = instantOrNull(value.availableUntil);
  return availableUntil === undefined ? null : { status: value.status as PrivacyExportStatus, availableUntil };
}

function decodeDeletionPart(value: unknown): PrivacyStateView['deletion'] | null {
  if (!isRecord(value) || typeof value.status !== 'string' || !DELETION_STATUSES.includes(value.status)) return null;
  const finalAt = instantOrNull(value.finalAt);
  return finalAt === undefined ? null : { status: value.status as PrivacyDeletionStatus, finalAt };
}

export function decodePrivacyState(body: unknown): PrivacyStateView | null {
  if (!isRecord(body)) return null;
  const exportPart = decodeExportPart(body.export);
  const deletionPart = decodeDeletionPart(body.deletion);
  return exportPart === null || deletionPart === null ? null : { export: exportPart, deletion: deletionPart };
}

export function decodeIdentity(body: unknown): AccountIdentityView | null {
  if (!isRecord(body)) return null;
  const { name, loginId, email, emailVerified } = body;
  if (name !== null && (typeof name !== 'string' || name === '')) return null;
  if (loginId !== null && (typeof loginId !== 'string' || loginId === '')) return null;
  if (typeof email !== 'string' || email === '' || typeof emailVerified !== 'boolean') return null;
  return { name, loginId, email, emailVerified };
}

export interface AccountApiConfig {
  /** Origin plus any base path, without a trailing slash. */
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function decodeFirstUse(body: unknown): AccountFirstUseView | null {
  if (!isRecord(body)) return null;
  const { displayName, welcomePending, firstConversationOpening } = body;
  if (displayName !== null && (typeof displayName !== 'string' || displayName === '')) return null;
  if (typeof welcomePending !== 'boolean' || typeof firstConversationOpening !== 'boolean') return null;
  return { displayName, welcomePending, firstConversationOpening };
}

export function decodePublicId(body: unknown): AccountPublicIdView | null {
  if (!isRecord(body)) return null;
  const { publicId, changeAvailable } = body;
  if (typeof publicId !== 'string' || publicId === '' || typeof changeAvailable !== 'boolean') return null;
  return { publicId, changeAvailable };
}

/** The signed-in account client. Built on the AC-01 seam bound to one identity. */
export class AccountApiClient {
  constructor(private readonly config: AccountApiConfig) {}

  async readFirstUse(): Promise<AccountFirstUseOutcome> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/account/first-use`, { method: 'GET', headers: { Accept: 'application/json' } });
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
    if (!response.ok) return { kind: 'UNAVAILABLE' };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
    const view = decodeFirstUse(body);
    return view === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', view };
  }

  /** Issued once. Whether it landed is reported; nothing is repeated here. */
  async completeWelcome(): Promise<boolean> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}/account/first-use/welcome`, { method: 'POST', headers: { Accept: 'application/json' } });
      return response.ok;
    } catch {
      // A refused credential seam or a dropped connection: either way the completion did not land.
      return false;
    }
  }

  /** W3-02 — the reader's own Public ID. Read once; never repeated here. */
  async readPublicId(): Promise<AccountPublicIdOutcome> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/account/public-id`, { method: 'GET', headers: { Accept: 'application/json' } });
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
    if (!response.ok) return { kind: 'UNAVAILABLE' };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
    const view = decodePublicId(body);
    return view === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', view };
  }

  /**
   * W3-02 — the reader's one lifetime Public ID change, issued once. The caller is the credential's; the
   * body is the command identity and the requested value, nothing else. Whether a failed request
   * committed is NOT decided here: the caller reconciles by reading.
   */
  async changePublicId(commandId: string, publicId: string): Promise<PublicIdChangeOutcome> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/account/public-id/change`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId, publicId }),
      });
    } catch {
      return { kind: 'NETWORK' };
    }
    if (response.status === 409) return { kind: 'CONFLICT' };
    if (!response.ok) return { kind: 'FAILED' };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'FAILED' };
    }
    const view = decodePublicId(body);
    if (view === null || !isRecord(body) || typeof body.outcome !== 'string' || !PUBLIC_ID_ANSWERS.includes(body.outcome)) return { kind: 'FAILED' };
    return { kind: 'ANSWERED', answer: body.outcome as PublicIdChangeAnswer, view };
  }

  /** W3-MEGA-A — the reader's own identity. Read once; never repeated here. */
  async readIdentity(): Promise<AccountIdentityOutcome> {
    const answer = await this.exchange('GET', '/account/identity');
    if (answer.kind !== 'OK') return { kind: 'UNAVAILABLE' };
    const view = decodeIdentity(answer.body);
    return view === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', view };
  }

  /** W3-MEGA-A — the reader's Name, issued once. A lost answer is reconciled by the caller, by reading. */
  async changeName(name: string): Promise<NameChangeOutcome> {
    const answer = await this.exchange('POST', '/account/name/change', { name });
    if (answer.kind !== 'OK') return answer.kind === 'STATUS' ? { kind: 'FAILED' } : answer;
    const { outcome, name: current } = answer.body;
    if ((outcome !== 'CHANGED' && outcome !== 'UNCHANGED' && outcome !== 'INVALID') || (current !== null && typeof current !== 'string')) return { kind: 'FAILED' };
    return { kind: 'ANSWERED', answer: outcome, name: current };
  }

  /** W3-MEGA-A — the reader's Login ID, with the password re-entered; ONE command identity per requested value. */
  async changeLoginId(commandId: string, loginId: string, password: string): Promise<LoginIdChangeOutcome> {
    const answer = await this.exchange('POST', '/account/login-id/change', { commandId, loginId, password });
    if (answer.kind === 'STATUS') return answer.status === 409 ? { kind: 'CONFLICT' } : { kind: 'FAILED' };
    if (answer.kind !== 'OK') return answer;
    const { outcome, loginId: current } = answer.body;
    if (outcome === 'PASSWORD_REJECTED') return { kind: 'PASSWORD_REJECTED' };
    if ((outcome !== 'CHANGED' && outcome !== 'UNCHANGED' && outcome !== 'INVALID' && outcome !== 'UNAVAILABLE') || typeof current !== 'string' || current === '') {
      return { kind: 'FAILED' };
    }
    return { kind: 'ANSWERED', answer: outcome, loginId: current };
  }

  /** W3-MEGA-A — start an Email change: the password, then the new Email. Nothing changes yet. */
  async requestEmailChange(password: string, email: string): Promise<EmailChangeRequestOutcome> {
    const answer = await this.exchange('POST', '/account/email/change', { password, email });
    if (answer.kind !== 'OK') return answer.kind === 'STATUS' ? { kind: 'FAILED' } : answer;
    const { outcome } = answer.body;
    return outcome === 'ACCEPTED' || outcome === 'UNCHANGED' || outcome === 'INVALID_EMAIL' || outcome === 'PASSWORD_REJECTED' ? { kind: outcome } : { kind: 'FAILED' };
  }

  /** W3-MEGA-A — finish an Email change with the code sent to the new Email and the code sent to the current one. */
  async confirmEmailChange(email: string, newEmailCode: string, currentEmailCode: string): Promise<EmailChangeConfirmOutcome> {
    const answer = await this.exchange('POST', '/account/email/confirm', { email, newEmailCode, currentEmailCode });
    if (answer.kind !== 'OK') return answer.kind === 'STATUS' ? { kind: 'FAILED' } : answer;
    const { outcome } = answer.body;
    return outcome === 'CHANGED' || outcome === 'CODE_REJECTED' ? { kind: outcome } : { kind: 'FAILED' };
  }

  /** W3-MEGA-A — change the password: the current one, then the new one. */
  async changePassword(password: string, newPassword: string): Promise<PasswordChangeOutcome> {
    const answer = await this.exchange('POST', '/account/password/change', { password, newPassword });
    if (answer.kind !== 'OK') return answer.kind === 'STATUS' ? { kind: 'FAILED' } : answer;
    const { outcome } = answer.body;
    return outcome === 'CHANGED' || outcome === 'CHANGED_SIGNED_OUT' || outcome === 'POLICY' || outcome === 'PASSWORD_REJECTED' ? { kind: outcome } : { kind: 'FAILED' };
  }

  /** W3-MEGA-A — sign out from every other device; this one stays signed in. */
  async signOutOtherDevices(): Promise<SignOutOthersOutcome> {
    const answer = await this.exchange('POST', '/account/sessions/sign-out-others', {});
    if (answer.kind !== 'OK') return answer.kind === 'STATUS' ? { kind: 'FAILED' } : answer;
    return answer.body.outcome === 'SIGNED_OUT_OTHERS' ? { kind: 'SIGNED_OUT_OTHERS' } : { kind: 'FAILED' };
  }

  /** W3-MEGA-S — the reader's own Privacy & Data state. Read once; never repeated here. */
  async readPrivacyState(): Promise<PrivacyStateOutcome> {
    const answer = await this.exchange('GET', '/account/privacy');
    if (answer.kind !== 'OK') return { kind: 'UNAVAILABLE' };
    const view = decodePrivacyState(answer.body);
    return view === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', view };
  }

  /** W3-MEGA-S — ask for a copy of the reader's data, with the password re-entered. ONE command identity per request. */
  async requestDataExport(commandId: string, password: string): Promise<PrivacyRequestOutcome> {
    const answer = await this.exchange('POST', '/account/privacy/export', { commandId, password });
    if (answer.kind !== 'OK') return answer.kind === 'STATUS' ? { kind: 'FAILED' } : answer;
    if (answer.body.outcome === 'PASSWORD_REJECTED') return { kind: 'PASSWORD_REJECTED' };
    const view = answer.body.outcome === 'ACCEPTED' ? decodeExportPart(answer.body.export) : null;
    return view === null ? { kind: 'FAILED' } : { kind: 'ACCEPTED', view };
  }

  /** W3-MEGA-S — the reader's ready package. The server decides whether it is still available. */
  async downloadDataExport(): Promise<ExportDownloadOutcome> {
    const answer = await this.exchange('GET', '/account/privacy/export/download');
    if (answer.kind !== 'OK') return answer.kind === 'STATUS' ? { kind: 'FAILED' } : answer;
    const { status, availableUntil, package: document } = answer.body;
    if (typeof status !== 'string' || !EXPORT_STATUSES.includes(status)) return { kind: 'FAILED' };
    if (status !== 'READY') return { kind: 'NOT_READY', status: status as PrivacyExportStatus };
    const until = instantOrNull(availableUntil);
    if (!isRecord(document) || until === undefined) return { kind: 'FAILED' };
    return { kind: 'READY', availableUntil: until, document };
  }

  /** W3-MEGA-S — ask for the account's deletion, with the password re-entered. ONE command identity per request. */
  async requestAccountDeletion(commandId: string, password: string): Promise<PrivacyRequestOutcome> {
    const answer = await this.exchange('POST', '/account/privacy/deletion', { commandId, password });
    if (answer.kind !== 'OK') return answer.kind === 'STATUS' ? { kind: 'FAILED' } : answer;
    const { outcome } = answer.body;
    if (outcome === 'PASSWORD_REJECTED') return { kind: 'PASSWORD_REJECTED' };
    if (outcome === 'CANCELLED') return { kind: 'CANCELLED' };
    const view = outcome === 'ACCEPTED' ? decodeDeletionPart(answer.body.deletion) : null;
    return view === null ? { kind: 'FAILED' } : { kind: 'ACCEPTED', view };
  }

  /** W3-MEGA-S — cancel the account's scheduled deletion. */
  async cancelAccountDeletion(): Promise<DeletionCancelOutcome> {
    const answer = await this.exchange('POST', '/account/privacy/deletion/cancel', {});
    if (answer.kind !== 'OK') return answer.kind === 'STATUS' ? { kind: 'FAILED' } : answer;
    const { outcome } = answer.body;
    return outcome === 'CANCELLED' || outcome === 'NONE' || outcome === 'NOT_CANCELLABLE' ? { kind: outcome } : { kind: 'FAILED' };
  }

  /** One request on the credential seam: a decoded object body, a non-2xx status, or no usable answer. */
  private async exchange(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, string>,
  ): Promise<{ readonly kind: 'OK'; readonly body: Record<string, unknown> } | { readonly kind: 'STATUS'; readonly status: number } | { readonly kind: 'FAILED' } | { readonly kind: 'NETWORK' }> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      return { kind: 'NETWORK' };
    }
    if (!response.ok) return { kind: 'STATUS', status: response.status };
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      return { kind: 'FAILED' };
    }
    return isRecord(parsed) ? { kind: 'OK', body: parsed } : { kind: 'FAILED' };
  }
}

/**
 * The one signed-out account question. It carries no credential — there is no account yet — and the
 * Login ID travels in the body, never in a URL.
 */
export class LoginIdAvailabilityClient {
  constructor(private readonly config: AccountApiConfig) {}

  async check(loginId: string): Promise<LoginIdAvailabilityOutcome> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/account/login-id-availability`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId }),
      });
    } catch {
      return { kind: 'NETWORK' };
    }
    if (!response.ok) return { kind: 'FAILED' };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'FAILED' };
    }
    if (!isRecord(body) || typeof body.available !== 'boolean') return { kind: 'FAILED' };
    return body.available ? { kind: 'AVAILABLE' } : { kind: 'TAKEN' };
  }
}
