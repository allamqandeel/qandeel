import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { PublicApprovalRequestRow, PublicReviewRow } from './public-authoring.repository';
import { PublicAuthoringRepository } from './public-authoring.repository';

export type PublicLifecycle = 'DRAFT' | 'READY_FOR_REVIEW';
export type PublicLabelMode = 'PSEUDONYM' | 'REAL_NAME';
export type OwnApprovalState = 'NOT_REQUIRED' | 'MISSING' | 'EFFECTIVE' | 'WITHDRAWN' | 'SUPERSEDED' | 'STALE';
export interface PublicPublisherView { readonly mode: PublicLabelMode; readonly label: string }

export interface PublicDraftsView {
  readonly drafts: ReadonlyArray<{ readonly experienceId: string; readonly lifecycle: PublicLifecycle; readonly hasPackage: boolean; readonly itemCount: number }>;
}
export interface PublicSourcesView {
  readonly personal: ReadonlyArray<{ readonly sourceId: string; readonly text: string; readonly at: string }>;
  readonly shared: ReadonlyArray<{
    readonly worldId: string; readonly materialId: string; readonly producer: 'HUMAN' | 'QANDEEL'; readonly isSelf: boolean;
    readonly authorName: string | null; readonly text: string; readonly at: string;
  }>;
}
export interface PublicDraftStartView { readonly outcome: 'CREATED' | 'ALREADY_CREATED'; readonly experienceId: string }
export interface PublicPackageView {
  readonly outcome: 'PREPARED' | 'ALREADY_PREPARED' | 'UNAVAILABLE' | 'NOT_PUBLISHABLE' | 'STALE' | 'NOT_DRAFT';
  readonly itemCount: number | null; readonly requiredApprovals: number | null;
}
export type PublicReviewView =
  | { readonly state: 'UNAVAILABLE' | 'NO_PACKAGE'; readonly lifecycle: PublicLifecycle | null; readonly publisher: PublicPublisherView | null }
  | {
    readonly state: 'CURRENT'; readonly lifecycle: PublicLifecycle; readonly manifestId: string; readonly publisher: PublicPublisherView; readonly itemCount: number;
    readonly requiredApprovals: number; readonly effectiveApprovals: number; readonly ownApproval: OwnApprovalState; readonly readyAllowed: boolean;
    readonly items: ReadonlyArray<{ readonly ordinal: number; readonly kind: 'SOURCE_CONTENT' | 'ANALYSIS'; readonly text: string }>;
  };
export interface PublicApprovalRequestView {
  readonly manifestId: string; readonly state: 'CURRENT' | 'UNAVAILABLE'; readonly lifecycle: PublicLifecycle;
  readonly publisher: PublicPublisherView | null; readonly itemCount: number | null; readonly ownItemCount: number | null;
  readonly requiredApprovals: number | null; readonly effectiveApprovals: number | null; readonly ownApproval: OwnApprovalState | null;
  readonly ownItems: ReadonlyArray<{ readonly ordinal: number; readonly text: string }>;
}
export interface PublicApprovalRequestsView { readonly requests: ReadonlyArray<PublicApprovalRequestView> }
export interface PublicApproveView { readonly outcome: 'APPROVED' | 'ALREADY_DECIDED' | 'UNAVAILABLE' | 'STALE' | 'NOT_DRAFT'; readonly ownApproval: OwnApprovalState | null }
export interface PublicWithdrawView { readonly outcome: 'WITHDRAWN' | 'ALREADY_WITHDRAWN' | 'UNAVAILABLE' }
export interface PublicReadyView {
  readonly outcome: 'READY_FOR_REVIEW' | 'ALREADY_READY' | 'APPROVALS_INCOMPLETE' | 'NO_PACKAGE' | 'UNAVAILABLE' | 'STALE' | 'NOT_DRAFT';
  readonly lifecycle: PublicLifecycle | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** The implementation bound of one package (the S4-03 history-package precedent): 1–20 exact sources. */
export const MAX_PACKAGE_SOURCES = 20;
const LIFECYCLES: readonly string[] = ['DRAFT', 'READY_FOR_REVIEW'];
const MODES: readonly string[] = ['PSEUDONYM', 'REAL_NAME'];
const OWN_STATES: readonly string[] = ['NOT_REQUIRED', 'MISSING', 'EFFECTIVE', 'WITHDRAWN', 'SUPERSEDED', 'STALE'];
const PACKAGE_OUTCOMES: readonly string[] = ['PREPARED', 'ALREADY_PREPARED', 'UNAVAILABLE', 'NOT_PUBLISHABLE', 'STALE', 'NOT_DRAFT'];
const APPROVE_OUTCOMES: readonly string[] = ['APPROVED', 'ALREADY_DECIDED', 'UNAVAILABLE', 'STALE', 'NOT_DRAFT'];
const WITHDRAW_OUTCOMES: readonly string[] = ['WITHDRAWN', 'ALREADY_WITHDRAWN', 'UNAVAILABLE'];
const READY_OUTCOMES: readonly string[] = ['READY_FOR_REVIEW', 'ALREADY_READY', 'APPROVALS_INCOMPLETE', 'NO_PACKAGE', 'UNAVAILABLE', 'STALE', 'NOT_DRAFT'];

const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Public authoring is unavailable.'); };
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const lifecycleOf = (value: unknown): PublicLifecycle | null => (typeof value === 'string' && LIFECYCLES.includes(value) ? value as PublicLifecycle : null);
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);
const publisherOf = (mode: unknown, label: unknown): PublicPublisherView | null =>
  (typeof mode === 'string' && MODES.includes(mode) && typeof label === 'string' && label.length > 0 ? { mode: mode as PublicLabelMode, label } : null);
const ownOf = (value: unknown): OwnApprovalState | null => (typeof value === 'string' && OWN_STATES.includes(value) ? value as OwnApprovalState : null);

/** The body is the caller's own fresh command id — and, for a package, the exact sources — and nothing else. */
function commandOf(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  if (!value || Object.keys(value).some((key) => !allowed.includes(key)) || !isUuid(value.commandId)) invalid();
  return value as Record<string, unknown>;
}

/**
 * S5-02 — the «العالم العام» / Public World authoring boundary over migration 0143, above the frozen I-05 runtime.
 *
 *   - start a Public Experience Draft (the first real authoring act provisions the ONE Public Identity, derived from the
 *     account's own Public display choice — never supplied);
 *   - list the caller's own eligible EXISTING material — their own committed Personal text and the visible Shared text
 *     of Worlds they currently belong to. There is no free-text composer: a Public Experience originates in QANDEEL;
 *   - prepare the exact immutable package from 1–20 of those sources;
 *   - the controller's truthful review of exactly what would become public, with bounded approval progress;
 *   - the content rightsholder's own approval requests, showing only the exact included content requiring this human's
 *     approval (their words, or QANDEEL output over which they hold the exact publication authority) — never another
 *     rightsholder's items, another approver, sealed provenance or hidden context; approve (authority over the content
 *     shown, not an endorsement of the Experience); withdraw;
 *   - DRAFT → READY_FOR_REVIEW, only with every current approval effective.
 *
 * Nothing here publishes: READY_FOR_REVIEW is not public, and the CW2-08 prerequisites stay NOT_EVALUATED. Identity
 * is the verified token only. Nothing is logged.
 */
@Injectable()
export class PublicAuthoringService {
  constructor(private readonly repository: PublicAuthoringRepository) {}

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }

  drafts(token: string): Promise<PublicDraftsView> {
    return this.guard(async () => {
      const rows = await this.repository.drafts(token);
      if (!Array.isArray(rows)) return unavailable();
      return {
        drafts: rows.map((row) => {
          const lifecycle = lifecycleOf(row.current_lifecycle);
          const itemCount = count(row.item_count);
          if (!isUuid(row.experience_id) || !lifecycle || typeof row.has_package !== 'boolean' || itemCount === null) return unavailable();
          return { experienceId: row.experience_id, lifecycle, hasPackage: row.has_package, itemCount };
        }),
      };
    });
  }

  sources(token: string): Promise<PublicSourcesView> {
    return this.guard(async () => {
      const rows = await this.repository.sources(token);
      if (!Array.isArray(rows)) return unavailable();
      const personal: Array<PublicSourcesView['personal'][number]> = [];
      const shared: Array<PublicSourcesView['shared'][number]> = [];
      for (const row of rows) {
        if (!isUuid(row.source_id) || typeof row.text_body !== 'string' || typeof row.established_at !== 'string') return unavailable();
        if (row.source_kind === 'PERSONAL') {
          personal.push({ sourceId: row.source_id, text: row.text_body, at: row.established_at });
        } else if (row.source_kind === 'SHARED' && isUuid(row.world_id) && typeof row.material_kind === 'string') {
          shared.push({
            worldId: row.world_id, materialId: row.source_id, producer: row.material_kind === 'HUMAN_TEXT' ? 'HUMAN' : 'QANDEEL',
            isSelf: row.is_self === true, authorName: typeof row.author_name === 'string' ? row.author_name : null,
            text: row.text_body, at: row.established_at,
          });
        } else {
          return unavailable();
        }
      }
      return { personal, shared };
    });
  }

  startDraft(token: string, body: unknown): Promise<PublicDraftStartView> {
    const { commandId } = commandOf(body, ['commandId']);
    return this.guard(async () => {
      const [row] = await this.repository.startDraft(token, commandId as string);
      if (!row || (row.outcome !== 'CREATED' && row.outcome !== 'ALREADY_CREATED') || !isUuid(row.experience_id)) return unavailable();
      return { outcome: row.outcome, experienceId: row.experience_id };
    });
  }

  preparePackage(token: string, experienceId: string, body: unknown): Promise<PublicPackageView> {
    const value = commandOf(body, ['commandId', 'personal', 'shared']);
    const personal = value.personal ?? [];
    const shared = value.shared ?? [];
    if (!Array.isArray(personal) || !Array.isArray(shared) || !personal.every(isUuid)) invalid();
    const sharedPairs = (shared as unknown[]).map((entry) => {
      const pair = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as Record<string, unknown> : null;
      if (!pair || Object.keys(pair).some((key) => key !== 'worldId' && key !== 'materialId') || !isUuid(pair.worldId) || !isUuid(pair.materialId)) invalid();
      return { worldId: (pair as Record<string, string>).worldId, materialId: (pair as Record<string, string>).materialId };
    });
    const total = (personal as string[]).length + sharedPairs.length;
    const distinct = new Set([...(personal as string[]), ...sharedPairs.map((p) => p.materialId)]).size;
    if (total < 1 || total > MAX_PACKAGE_SOURCES || distinct !== total) invalid();
    if (!isUuid(experienceId)) return Promise.resolve({ outcome: 'UNAVAILABLE', itemCount: null, requiredApprovals: null });
    return this.guard(async () => {
      const [row] = await this.repository.preparePackage(token, value.commandId as string, experienceId, personal as string[],
        sharedPairs.map((p) => p.worldId), sharedPairs.map((p) => p.materialId));
      if (!row || !PACKAGE_OUTCOMES.includes(row.outcome)) return unavailable();
      return { outcome: row.outcome as PublicPackageView['outcome'], itemCount: count(row.item_count), requiredApprovals: count(row.required_approver_count) };
    });
  }

  review(token: string, experienceId: string): Promise<PublicReviewView> {
    if (!isUuid(experienceId)) return Promise.resolve({ state: 'UNAVAILABLE', lifecycle: null, publisher: null });
    return this.guard(async () => {
      const rows = await this.repository.review(token, experienceId);
      if (!Array.isArray(rows)) return unavailable();
      // No row: not this human's Draft, or none at all. One neutral answer.
      if (rows.length === 0) return { state: 'UNAVAILABLE', lifecycle: null, publisher: null };
      return reviewOf(rows);
    });
  }

  approvalRequests(token: string): Promise<PublicApprovalRequestsView> {
    return this.guard(async () => {
      const rows = await this.repository.approvalRequests(token);
      if (!Array.isArray(rows)) return unavailable();
      return { requests: requestsOf(rows) };
    });
  }

  approve(token: string, manifestId: string, body: unknown): Promise<PublicApproveView> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!isUuid(manifestId)) return Promise.resolve({ outcome: 'UNAVAILABLE', ownApproval: null });
    return this.guard(async () => {
      const [row] = await this.repository.approve(token, commandId as string, manifestId);
      if (!row || !APPROVE_OUTCOMES.includes(row.outcome)) return unavailable();
      return { outcome: row.outcome as PublicApproveView['outcome'], ownApproval: ownOf(row.own_approval_state) };
    });
  }

  withdraw(token: string, manifestId: string, body: unknown): Promise<PublicWithdrawView> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!isUuid(manifestId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      const [row] = await this.repository.withdraw(token, commandId as string, manifestId);
      if (!row || !WITHDRAW_OUTCOMES.includes(row.outcome)) return unavailable();
      return { outcome: row.outcome as PublicWithdrawView['outcome'] };
    });
  }

  ready(token: string, experienceId: string, body: unknown): Promise<PublicReadyView> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!isUuid(experienceId)) return Promise.resolve({ outcome: 'UNAVAILABLE', lifecycle: null });
    return this.guard(async () => {
      const [row] = await this.repository.ready(token, commandId as string, experienceId);
      if (!row || !READY_OUTCOMES.includes(row.outcome)) return unavailable();
      return { outcome: row.outcome as PublicReadyView['outcome'], lifecycle: lifecycleOf(row.current_lifecycle) };
    });
  }
}

function reviewOf(rows: readonly PublicReviewRow[]): PublicReviewView {
  const [head] = rows;
  const lifecycle = lifecycleOf(head.current_lifecycle);
  const publisher = publisherOf(head.publisher_label_mode, head.publisher_display_label);
  if (head.review_state === 'UNAVAILABLE' || head.review_state === 'NO_PACKAGE') {
    if (rows.length !== 1) return unavailable();
    return { state: head.review_state, lifecycle, publisher };
  }
  if (head.review_state !== 'CURRENT' || !lifecycle || !publisher) return unavailable();
  const itemCount = count(head.item_count);
  const required = count(head.required_approver_count);
  const effective = count(head.effective_approval_count);
  const own = ownOf(head.own_approval_state);
  if (itemCount === null || required === null || effective === null || !own || typeof head.ready_allowed !== 'boolean' || !isUuid(head.manifest_version_id)) return unavailable();
  const items = rows.map((row) => {
    if (row.review_state !== 'CURRENT' || count(row.item_ordinal) === null || typeof row.public_text_body !== 'string') return unavailable();
    const kind: 'SOURCE_CONTENT' | 'ANALYSIS' = row.derivative_classification === 'SOURCE_CONTENT_BEARING_DERIVATIVE' ? 'SOURCE_CONTENT'
      : row.derivative_classification === 'ANALYTICAL_DERIVATIVE' ? 'ANALYSIS' : unavailable();
    return { ordinal: row.item_ordinal as number, kind, text: row.public_text_body };
  });
  // A package is shown whole or not at all.
  if (items.length !== itemCount) return unavailable();
  return { state: 'CURRENT', lifecycle, manifestId: head.manifest_version_id as string, publisher, itemCount, requiredApprovals: required, effectiveApprovals: effective,
    ownApproval: own, readyAllowed: head.ready_allowed, items };
}

function requestsOf(rows: readonly PublicApprovalRequestRow[]): PublicApprovalRequestView[] {
  const byManifest = new Map<string, PublicApprovalRequestRow[]>();
  for (const row of rows) {
    if (!isUuid(row.manifest_version_id)) return unavailable();
    byManifest.set(row.manifest_version_id, [...(byManifest.get(row.manifest_version_id) ?? []), row]);
  }
  return [...byManifest.entries()].map(([manifestId, group]) => {
    const [head] = group;
    const lifecycle = lifecycleOf(head.current_lifecycle);
    if (!lifecycle) return unavailable();
    if (head.request_state === 'UNAVAILABLE') {
      return { manifestId, state: 'UNAVAILABLE', lifecycle, publisher: publisherOf(head.publisher_label_mode, head.publisher_display_label),
        itemCount: null, ownItemCount: null, requiredApprovals: null, effectiveApprovals: null, ownApproval: null, ownItems: [] };
    }
    if (head.request_state !== 'CURRENT') return unavailable();
    const ownItems = group.map((row) => {
      if (count(row.item_ordinal) === null || typeof row.public_text_body !== 'string') return unavailable();
      return { ordinal: row.item_ordinal as number, text: row.public_text_body };
    });
    const ownItemCount = count(head.own_item_count);
    if (ownItemCount === null || ownItemCount !== ownItems.length) return unavailable();
    return {
      manifestId, state: 'CURRENT', lifecycle, publisher: publisherOf(head.publisher_label_mode, head.publisher_display_label),
      itemCount: count(head.item_count), ownItemCount, requiredApprovals: count(head.required_approver_count),
      effectiveApprovals: count(head.effective_approval_count), ownApproval: ownOf(head.own_approval_state), ownItems,
    };
  });
}
