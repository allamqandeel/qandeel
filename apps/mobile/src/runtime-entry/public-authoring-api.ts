/**
 * S5-02 — the client for the Public authoring routes inside «العالم العام» / Public World.
 *
 *   GET  /public/authoring                                 the reader's own non-public Drafts
 *   GET  /public/authoring/sources                         the reader's own eligible EXISTING material
 *   POST /public/authoring/drafts                          { commandId } → start a Draft
 *   POST /public/authoring/drafts/:id/package              { commandId, personal, shared } → prepare the exact package
 *   GET  /public/authoring/drafts/:id/review               what would become public, whole or not at all
 *   POST /public/authoring/drafts/:id/ready                { commandId } → DRAFT → READY_FOR_REVIEW
 *   GET  /public/authoring/approvals                       the reader's own content-approval requests
 *   POST /public/authoring/approvals/:manifestId/approve   { commandId }
 *   POST /public/authoring/approvals/:manifestId/withdraw  { commandId }
 *
 * A transport and nothing else, exactly like the Public World client it lives beside: no credential of its own, no user
 * id, no Public ref, no label, no approver, no body text, no retry, no meaning. Every answer is decoded strictly;
 * anything else is no answer. Nothing here can publish.
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

export interface PublicAuthoringApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

export type PublicAuthoringLifecycle = 'DRAFT' | 'READY_FOR_REVIEW';
export type PublicOwnApproval = 'NOT_REQUIRED' | 'MISSING' | 'EFFECTIVE' | 'WITHDRAWN' | 'SUPERSEDED' | 'STALE';
export interface PublicAuthoringPublisher { readonly mode: 'PSEUDONYM' | 'REAL_NAME'; readonly label: string }
export interface PublicAuthoringDraft { readonly experienceId: string; readonly lifecycle: PublicAuthoringLifecycle; readonly hasPackage: boolean; readonly itemCount: number }
export interface PublicPersonalSource { readonly sourceId: string; readonly text: string; readonly at: string }
export interface PublicSharedSource {
  readonly worldId: string; readonly materialId: string; readonly producer: 'HUMAN' | 'QANDEEL'; readonly isSelf: boolean;
  readonly authorName: string | null; readonly text: string; readonly at: string;
}
export interface PublicAuthoringSources { readonly personal: ReadonlyArray<PublicPersonalSource>; readonly shared: ReadonlyArray<PublicSharedSource> }
export type PublicAuthoringReview =
  | { readonly state: 'UNAVAILABLE' | 'NO_PACKAGE'; readonly lifecycle: PublicAuthoringLifecycle | null; readonly publisher: PublicAuthoringPublisher | null }
  | {
    readonly state: 'CURRENT'; readonly lifecycle: PublicAuthoringLifecycle; readonly manifestId: string; readonly publisher: PublicAuthoringPublisher;
    readonly itemCount: number; readonly requiredApprovals: number; readonly effectiveApprovals: number;
    readonly ownApproval: PublicOwnApproval; readonly readyAllowed: boolean;
    readonly items: ReadonlyArray<{ readonly ordinal: number; readonly kind: 'SOURCE_CONTENT' | 'ANALYSIS'; readonly text: string }>;
  };
export interface PublicApprovalRequest {
  readonly manifestId: string; readonly state: 'CURRENT' | 'UNAVAILABLE'; readonly lifecycle: PublicAuthoringLifecycle;
  readonly publisher: PublicAuthoringPublisher | null; readonly itemCount: number | null; readonly ownItemCount: number | null;
  readonly requiredApprovals: number | null; readonly effectiveApprovals: number | null; readonly ownApproval: PublicOwnApproval | null;
  readonly ownItems: ReadonlyArray<{ readonly ordinal: number; readonly text: string }>;
}
export type PublicPackageOutcome = 'PREPARED' | 'ALREADY_PREPARED' | 'UNAVAILABLE' | 'NOT_PUBLISHABLE' | 'STALE' | 'NOT_DRAFT';
export type PublicApproveOutcome = 'APPROVED' | 'ALREADY_DECIDED' | 'UNAVAILABLE' | 'STALE' | 'NOT_DRAFT';
export type PublicWithdrawOutcome = 'WITHDRAWN' | 'ALREADY_WITHDRAWN' | 'UNAVAILABLE';
export type PublicReadyOutcome = 'READY_FOR_REVIEW' | 'ALREADY_READY' | 'APPROVALS_INCOMPLETE' | 'NO_PACKAGE' | 'UNAVAILABLE' | 'STALE' | 'NOT_DRAFT';

/** `NO_ANSWER` is a transport or decoding failure: never a decision. */
export type PublicAuthoringAnswer<T> = { readonly kind: 'ANSWER'; readonly value: T } | { readonly kind: 'NO_ANSWER' };

type Exchange = { readonly kind: 'OK'; readonly body: unknown } | { readonly kind: 'STATUS'; readonly status: number } | { readonly kind: 'NETWORK' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isLifecycle = (value: unknown): value is PublicAuthoringLifecycle => value === 'DRAFT' || value === 'READY_FOR_REVIEW';
const OWN: readonly string[] = ['NOT_REQUIRED', 'MISSING', 'EFFECTIVE', 'WITHDRAWN', 'SUPERSEDED', 'STALE'];
const isOwn = (value: unknown): value is PublicOwnApproval => typeof value === 'string' && OWN.includes(value);
const publisherOf = (value: unknown): PublicAuthoringPublisher | null | undefined => {
  if (value === null) return null;
  if (!isRecord(value) || (value.mode !== 'PSEUDONYM' && value.mode !== 'REAL_NAME') || typeof value.label !== 'string' || value.label.length === 0) return undefined;
  return { mode: value.mode, label: value.label };
};
const NO: { readonly kind: 'NO_ANSWER' } = Object.freeze({ kind: 'NO_ANSWER' as const });
const yes = <T>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });

function oneOf<T extends string>(body: unknown, key: string, allowed: readonly T[]): T | null {
  return isRecord(body) && typeof body[key] === 'string' && (allowed as readonly string[]).includes(body[key] as string) ? body[key] as T : null;
}

export class PublicAuthoringApiClient {
  constructor(private readonly config: PublicAuthoringApiConfig) {}

  async drafts(): Promise<PublicAuthoringAnswer<ReadonlyArray<PublicAuthoringDraft>>> {
    const answer = await this.exchange('GET', '/public/authoring');
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !Array.isArray(answer.body.drafts)) return NO;
    const drafts: PublicAuthoringDraft[] = [];
    for (const d of answer.body.drafts as unknown[]) {
      if (!isRecord(d) || !isUuid(d.experienceId) || !isLifecycle(d.lifecycle) || typeof d.hasPackage !== 'boolean' || !isCount(d.itemCount)) return NO;
      drafts.push({ experienceId: d.experienceId, lifecycle: d.lifecycle, hasPackage: d.hasPackage, itemCount: d.itemCount });
    }
    return yes(drafts);
  }

  async sources(): Promise<PublicAuthoringAnswer<PublicAuthoringSources>> {
    const answer = await this.exchange('GET', '/public/authoring/sources');
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !Array.isArray(answer.body.personal) || !Array.isArray(answer.body.shared)) return NO;
    const personal: PublicPersonalSource[] = [];
    for (const s of answer.body.personal as unknown[]) {
      if (!isRecord(s) || !isUuid(s.sourceId) || typeof s.text !== 'string' || typeof s.at !== 'string') return NO;
      personal.push({ sourceId: s.sourceId, text: s.text, at: s.at });
    }
    const shared: PublicSharedSource[] = [];
    for (const s of answer.body.shared as unknown[]) {
      if (!isRecord(s) || !isUuid(s.worldId) || !isUuid(s.materialId) || (s.producer !== 'HUMAN' && s.producer !== 'QANDEEL')
        || typeof s.isSelf !== 'boolean' || (s.authorName !== null && typeof s.authorName !== 'string') || typeof s.text !== 'string' || typeof s.at !== 'string') return NO;
      shared.push({ worldId: s.worldId, materialId: s.materialId, producer: s.producer, isSelf: s.isSelf, authorName: s.authorName as string | null, text: s.text, at: s.at });
    }
    return yes({ personal, shared });
  }

  async startDraft(commandId: string): Promise<PublicAuthoringAnswer<{ readonly outcome: 'CREATED' | 'ALREADY_CREATED'; readonly experienceId: string }>> {
    const answer = await this.exchange('POST', '/public/authoring/drafts', { commandId });
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !isUuid(answer.body.experienceId)) return NO;
    const outcome = oneOf(answer.body, 'outcome', ['CREATED', 'ALREADY_CREATED'] as const);
    return outcome ? yes({ outcome, experienceId: answer.body.experienceId }) : NO;
  }

  async preparePackage(experienceId: string, commandId: string, personal: readonly string[],
    shared: ReadonlyArray<{ readonly worldId: string; readonly materialId: string }>): Promise<PublicAuthoringAnswer<PublicPackageOutcome>> {
    const answer = await this.exchange('POST', `/public/authoring/drafts/${encodeURIComponent(experienceId)}/package`, {
      commandId, personal: [...personal], shared: shared.map((s) => ({ worldId: s.worldId, materialId: s.materialId })),
    });
    if (answer.kind !== 'OK') return NO;
    const outcome = oneOf(answer.body, 'outcome', ['PREPARED', 'ALREADY_PREPARED', 'UNAVAILABLE', 'NOT_PUBLISHABLE', 'STALE', 'NOT_DRAFT'] as const);
    return outcome ? yes(outcome) : NO;
  }

  async review(experienceId: string): Promise<PublicAuthoringAnswer<PublicAuthoringReview>> {
    const answer = await this.exchange('GET', `/public/authoring/drafts/${encodeURIComponent(experienceId)}/review`);
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return NO;
    const b = answer.body;
    const publisher = publisherOf(b.publisher);
    if (publisher === undefined) return NO;
    if (b.state === 'UNAVAILABLE' || b.state === 'NO_PACKAGE') {
      if (b.lifecycle !== null && !isLifecycle(b.lifecycle)) return NO;
      return yes({ state: b.state, lifecycle: b.lifecycle as PublicAuthoringLifecycle | null, publisher });
    }
    if (b.state !== 'CURRENT' || !isLifecycle(b.lifecycle) || !isUuid(b.manifestId) || publisher === null || !isCount(b.itemCount)
      || !isCount(b.requiredApprovals) || !isCount(b.effectiveApprovals) || !isOwn(b.ownApproval) || typeof b.readyAllowed !== 'boolean'
      || !Array.isArray(b.items)) return NO;
    const items: Array<{ readonly ordinal: number; readonly kind: 'SOURCE_CONTENT' | 'ANALYSIS'; readonly text: string }> = [];
    for (const item of b.items as unknown[]) {
      if (!isRecord(item) || !isCount(item.ordinal) || (item.kind !== 'SOURCE_CONTENT' && item.kind !== 'ANALYSIS') || typeof item.text !== 'string') return NO;
      items.push({ ordinal: item.ordinal, kind: item.kind, text: item.text });
    }
    // A package is shown whole or not at all.
    if (items.length !== b.itemCount) return NO;
    return yes({ state: 'CURRENT', lifecycle: b.lifecycle, manifestId: b.manifestId, publisher, itemCount: b.itemCount,
      requiredApprovals: b.requiredApprovals, effectiveApprovals: b.effectiveApprovals, ownApproval: b.ownApproval, readyAllowed: b.readyAllowed, items });
  }

  async approvalRequests(): Promise<PublicAuthoringAnswer<ReadonlyArray<PublicApprovalRequest>>> {
    const answer = await this.exchange('GET', '/public/authoring/approvals');
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !Array.isArray(answer.body.requests)) return NO;
    const requests: PublicApprovalRequest[] = [];
    for (const r of answer.body.requests as unknown[]) {
      if (!isRecord(r) || !isUuid(r.manifestId) || (r.state !== 'CURRENT' && r.state !== 'UNAVAILABLE') || !isLifecycle(r.lifecycle)
        || !Array.isArray(r.ownItems)) return NO;
      const publisher = publisherOf(r.publisher);
      if (publisher === undefined) return NO;
      const counts = [r.itemCount, r.ownItemCount, r.requiredApprovals, r.effectiveApprovals];
      if (counts.some((c) => c !== null && !isCount(c)) || (r.ownApproval !== null && !isOwn(r.ownApproval))) return NO;
      const ownItems: Array<{ readonly ordinal: number; readonly text: string }> = [];
      for (const item of r.ownItems as unknown[]) {
        if (!isRecord(item) || !isCount(item.ordinal) || typeof item.text !== 'string') return NO;
        ownItems.push({ ordinal: item.ordinal, text: item.text });
      }
      requests.push({ manifestId: r.manifestId, state: r.state, lifecycle: r.lifecycle, publisher,
        itemCount: r.itemCount as number | null, ownItemCount: r.ownItemCount as number | null,
        requiredApprovals: r.requiredApprovals as number | null, effectiveApprovals: r.effectiveApprovals as number | null,
        ownApproval: r.ownApproval as PublicOwnApproval | null, ownItems });
    }
    return yes(requests);
  }

  async approve(manifestId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicApproveOutcome>> {
    const answer = await this.exchange('POST', `/public/authoring/approvals/${encodeURIComponent(manifestId)}/approve`, { commandId });
    if (answer.kind !== 'OK') return NO;
    const outcome = oneOf(answer.body, 'outcome', ['APPROVED', 'ALREADY_DECIDED', 'UNAVAILABLE', 'STALE', 'NOT_DRAFT'] as const);
    return outcome ? yes(outcome) : NO;
  }

  async withdraw(manifestId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicWithdrawOutcome>> {
    const answer = await this.exchange('POST', `/public/authoring/approvals/${encodeURIComponent(manifestId)}/withdraw`, { commandId });
    if (answer.kind !== 'OK') return NO;
    const outcome = oneOf(answer.body, 'outcome', ['WITHDRAWN', 'ALREADY_WITHDRAWN', 'UNAVAILABLE'] as const);
    return outcome ? yes(outcome) : NO;
  }

  async ready(experienceId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicReadyOutcome>> {
    const answer = await this.exchange('POST', `/public/authoring/drafts/${encodeURIComponent(experienceId)}/ready`, { commandId });
    if (answer.kind !== 'OK') return NO;
    const outcome = oneOf(answer.body, 'outcome', ['READY_FOR_REVIEW', 'ALREADY_READY', 'APPROVALS_INCOMPLETE', 'NO_PACKAGE', 'UNAVAILABLE', 'STALE', 'NOT_DRAFT'] as const);
    return outcome ? yes(outcome) : NO;
  }

  private async exchange(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<Exchange> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      if (!response.ok) return { kind: 'STATUS', status: response.status };
      return { kind: 'OK', body: (await response.json()) as unknown };
    } catch {
      return { kind: 'NETWORK' };
    }
  }
}
