import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';
import {
  SharedWorldLifecycleRepository, type SharedClosedMaterialRow, type SharedFormerHistoryRequestRow, type SharedHistoryRequestRow,
  type SharedLifecycleCursor, type SharedProposalRow,
} from './shared-world-lifecycle.repository';
import { SharedWorldRepository } from './shared-world.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** An instant exactly as the reads return it (ISO 8601 with an offset), never a free-form date. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;

/** Engineering input bounds of the Product boundary; migration 0140 re-checks them. */
export const SHARED_SETTINGS_BOUNDS = Object.freeze({ name: 80, description: 500, topic: 120 });
/** One package of earlier history: 1–20 exact messages (0140 re-checks). */
export const SHARED_HISTORY_PACKAGE_MAX = 20;
/** Bounded reads: one page and one row beyond it says whether older rows exist, without counting anything. */
export const SHARED_LIFECYCLE_PAGE = 50;
/** A typed Shared ID is short; anything longer is not one (0140 normalizes and refuses it as INVALID_SHARED_ID). */
export const SHARED_ID_INPUT_MAX = 64;

export interface SharedLifecycleMemberView { readonly handle: string; readonly name: string | null; readonly self: boolean }
export interface SharedSettingsValues { readonly name: string | null; readonly description: string | null; readonly topic: string | null }
export interface SharedProposalView {
  readonly proposalId: string;
  readonly kind: 'SETTINGS' | 'REMOVAL' | 'END' | 'ADD' | 'REJOIN';
  /** Who proposed it (no authority comes with it): their Name, or the reader themselves. */
  readonly proposer: { readonly name: string | null; readonly self: boolean };
  /** The member a removal would remove (their legitimate Name); null otherwise — an add / rejoin target is never named. */
  readonly targetName: string | null;
  /** The exact proposed version (SETTINGS only). */
  readonly settings: SharedSettingsValues | null;
  /** Whether THIS reader approved. Nobody else's approval is ever shown — only the neutral progress below. */
  readonly approvedBySelf: boolean;
  readonly progress: { readonly approved: number; readonly required: number };
}
export interface SharedHistoryRequestView {
  readonly packageId: string;
  readonly granteeName: string | null;
  readonly approvedBySelf: boolean;
  /** Exactly the reader's OWN words in the package: what the reader is asked to authorize. */
  readonly items: readonly { readonly materialId: string; readonly text: string; readonly establishedAt: string }[];
}
export type SharedManageView =
  | {
    readonly outcome: 'ALLOW';
    readonly capabilities: { readonly governance: boolean; readonly history: boolean };
    readonly settings: SharedSettingsValues;
    readonly members: readonly SharedLifecycleMemberView[];
    readonly proposals: readonly SharedProposalView[];
    readonly historyRequests: readonly SharedHistoryRequestView[];
  }
  | { readonly outcome: 'UNAVAILABLE' };
export type SharedHistoryCandidatesView =
  | {
    readonly outcome: 'ALLOW';
    /** Oldest first: one bounded page; `hasOlder` reaches the next one (a page, never a ceiling). */
    readonly candidates: readonly { readonly materialId: string; readonly self: boolean; readonly authorName: string | null; readonly text: string; readonly establishedAt: string }[];
    readonly hasOlder: boolean;
  }
  | { readonly outcome: 'UNAVAILABLE' };
/** A former member's surviving material authority: exactly their own words in each package, nothing of the World. */
export interface SharedFormerHistoryRequestView {
  readonly packageId: string;
  readonly worldId: string;
  readonly approvedBySelf: boolean;
  readonly items: readonly { readonly materialId: string; readonly text: string; readonly establishedAt: string }[];
}
export interface SharedClosedMaterialView {
  readonly materialId: string;
  readonly producer: 'SELF' | 'HUMAN' | 'QANDEEL';
  readonly authorName: string | null;
  readonly text: string;
  readonly establishedAt: string;
}
export type SharedClosedWorldView =
  | {
    readonly outcome: 'ALLOW';
    readonly world: { readonly worldId: string; readonly name: string | null; readonly members: readonly { readonly name: string | null; readonly self: boolean }[] };
    /** Oldest first: one bounded page of the entitled material. */
    readonly materials: readonly SharedClosedMaterialView[];
    readonly hasOlder: boolean;
  }
  | { readonly outcome: 'UNAVAILABLE' };
export interface SharedOwnMaterialView { readonly materialId: string; readonly worldId: string; readonly text: string; readonly establishedAt: string }
export interface SharedOwnMaterialPageView { readonly materials: readonly SharedOwnMaterialView[]; readonly hasOlder: boolean }

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Shared World is unavailable.'); };
function commandOf(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  const value = record(body);
  if (Object.keys(value).some((key) => !allowed.includes(key)) || typeof value.commandId !== 'string' || !UUID.test(value.commandId)) invalid();
  return value;
}
function cursorOf(materialId: string, establishedAt: string): SharedLifecycleCursor {
  if (!UUID.test(materialId) || !INSTANT.test(establishedAt) || !Number.isFinite(Date.parse(establishedAt))) invalid();
  return { materialId, establishedAt };
}
const boundedText = (value: unknown, max: number): string => {
  if (typeof value !== 'string' || value.length > max) invalid();
  return value as string;
};
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const KINDS: Readonly<Record<string, SharedProposalView['kind']>> = {
  WORLD_SETTINGS_CHANGE: 'SETTINGS', REMOVE_MEMBER: 'REMOVAL', END_WORLD: 'END', ADD_MEMBER: 'ADD', REJOIN_MEMBER: 'REJOIN',
};
const count = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

function proposalOf(row: SharedProposalRow): SharedProposalView | null {
  const kind = KINDS[row.operation_kind];
  if (kind === undefined || !isUuid(row.proposal_id) || typeof row.approved_by_self !== 'boolean' || typeof row.proposer_is_self !== 'boolean'
    || !count(row.approved_count) || !count(row.required_count) || row.required_count === 0 || row.approved_count > row.required_count) return null;
  return {
    proposalId: row.proposal_id, kind,
    proposer: { name: row.proposer_is_self ? null : row.proposer_name ?? null, self: row.proposer_is_self },
    targetName: kind === 'REMOVAL' ? row.target_name ?? null : null,
    settings: kind === 'SETTINGS' ? { name: row.proposed_name, description: row.proposed_description, topic: row.proposed_topic } : null,
    approvedBySelf: row.approved_by_self,
    progress: { approved: row.approved_count, required: row.required_count },
  };
}

function formerRequestsOf(rows: readonly SharedFormerHistoryRequestRow[]): SharedFormerHistoryRequestView[] | null {
  const byPackage = new Map<string, { worldId: string; approvedBySelf: boolean; items: { materialId: string; text: string; establishedAt: string }[] }>();
  for (const row of rows) {
    if (!isUuid(row.package_id) || !isUuid(row.world_id) || !isUuid(row.material_id) || typeof row.text_body !== 'string'
      || typeof row.approved_by_self !== 'boolean') return null;
    const held = byPackage.get(row.package_id) ?? { worldId: row.world_id, approvedBySelf: row.approved_by_self, items: [] };
    held.items.push({ materialId: row.material_id, text: row.text_body, establishedAt: row.established_at });
    byPackage.set(row.package_id, held);
  }
  return [...byPackage.entries()].map(([packageId, held]) => ({ packageId, ...held }));
}

function requestsOf(rows: readonly SharedHistoryRequestRow[]): SharedHistoryRequestView[] | null {
  const byPackage = new Map<string, { granteeName: string | null; approvedBySelf: boolean; items: { materialId: string; text: string; establishedAt: string }[] }>();
  for (const row of rows) {
    if (!isUuid(row.package_id) || !isUuid(row.material_id) || typeof row.text_body !== 'string' || typeof row.approved_by_self !== 'boolean') return null;
    const held = byPackage.get(row.package_id) ?? { granteeName: row.grantee_name ?? null, approvedBySelf: row.approved_by_self, items: [] };
    held.items.push({ materialId: row.material_id, text: row.text_body, establishedAt: row.established_at });
    byPackage.set(row.package_id, held);
  }
  return [...byPackage.entries()].map(([packageId, held]) => ({ packageId, ...held }));
}

function closedMaterialOf(row: SharedClosedMaterialRow): SharedClosedMaterialView | null {
  if (!isUuid(row.material_id) || typeof row.text_body !== 'string' || typeof row.established_at !== 'string' || typeof row.is_self !== 'boolean') return null;
  if (row.producer_kind === 'QANDEEL') return { materialId: row.material_id, producer: 'QANDEEL', authorName: null, text: row.text_body, establishedAt: row.established_at };
  if (row.producer_kind !== 'HUMAN') return null;
  return {
    materialId: row.material_id, producer: row.is_self ? 'SELF' : 'HUMAN', authorName: row.is_self ? null : row.author_name ?? null,
    text: row.text_body, establishedAt: row.established_at,
  };
}

/**
 * S4-03 — the Shared lifecycle Product boundary over migration 0140: one World's management (settings, members, the
 * proposals and history requests that wait on THIS human), leave, governed removal / settings / World end, approvals,
 * selective history sharing, the closed World's read-only view, and the reader's own words in Worlds they no longer
 * belong to. Identity is the verified token only; nothing of a current World is returned before the S4-01 entry verdict
 * is ALLOW, and nothing of a closed World without the reader's closed-view entitlement. Nothing is logged.
 */
@Injectable()
export class SharedWorldLifecycleService {
  constructor(private readonly shared: SharedWorldRepository, private readonly lifecycle: SharedWorldLifecycleRepository) {}

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      // A request the database itself refuses as malformed (22023 → 400): the client's own contradiction.
      if (error instanceof DataApiError && error.status === 400) return invalid();
      return unavailable();
    }
  }

  private async allowed(token: string, worldId: string): Promise<boolean> {
    const [verdict] = await this.shared.resolveEntry(token, worldId);
    return verdict?.outcome === 'ALLOW' && verdict.world_id === worldId;
  }

  manage(token: string, worldId: string): Promise<SharedManageView> {
    if (!isUuid(worldId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      if (!(await this.allowed(token, worldId))) return { outcome: 'UNAVAILABLE' };
      const [[capabilities], [settings], members, proposalRows, requestRows] = await Promise.all([
        this.lifecycle.capabilities(token), this.lifecycle.settings(token, worldId), this.lifecycle.members(token, worldId),
        this.lifecycle.proposals(token, worldId), this.lifecycle.historyRequests(token, worldId),
      ]);
      // The authority moved between the verdict and the reads: nothing of the World is returned.
      if (settings === undefined || members.length === 0) return { outcome: 'UNAVAILABLE' };
      if (capabilities === undefined) return unavailable();
      const proposals = proposalRows.map(proposalOf);
      const historyRequests = requestsOf(requestRows);
      if (proposals.some((p) => p === null) || historyRequests === null || members.some((m) => !isUuid(m.member_handle) || typeof m.is_self !== 'boolean')) {
        return unavailable();
      }
      return {
        outcome: 'ALLOW',
        capabilities: { governance: capabilities.governance_available === true, history: capabilities.history_available === true },
        settings: { name: settings.world_name, description: settings.world_description, topic: settings.world_topic },
        members: members.map((m) => ({ handle: m.member_handle, name: m.member_name, self: m.is_self })),
        proposals: proposals as SharedProposalView[],
        historyRequests,
      };
    });
  }

  async leave(token: string, worldId: string, body: unknown): Promise<{ readonly outcome: 'LEFT' | 'UNAVAILABLE' }> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      const [row] = await this.lifecycle.leave(token, commandId as string, worldId);
      if (row?.outcome === 'LEFT' || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  async proposeSettings(token: string, worldId: string, body: unknown): Promise<{ readonly outcome: 'PROPOSED' | 'UNCHANGED' | 'UNAVAILABLE' }> {
    const value = commandOf(body, ['commandId', 'name', 'description', 'topic']);
    const values = {
      name: boundedText(value.name, SHARED_SETTINGS_BOUNDS.name),
      description: boundedText(value.description, SHARED_SETTINGS_BOUNDS.description),
      topic: boundedText(value.topic, SHARED_SETTINGS_BOUNDS.topic),
    };
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      const [row] = await this.lifecycle.proposeSettings(token, value.commandId as string, worldId, values);
      if (row?.outcome === 'PROPOSED' || row?.outcome === 'UNCHANGED' || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  async proposeRemoval(token: string, worldId: string, body: unknown): Promise<{ readonly outcome: 'PROPOSED' | 'UNAVAILABLE' }> {
    const value = commandOf(body, ['commandId', 'memberHandle']);
    if (!isUuid(value.memberHandle)) invalid();
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      const [row] = await this.lifecycle.proposeRemoval(token, value.commandId as string, worldId, value.memberHandle as string);
      if (row?.outcome === 'PROPOSED' || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  async proposeEnd(token: string, worldId: string, body: unknown): Promise<{ readonly outcome: 'PROPOSED' | 'UNAVAILABLE' }> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      const [row] = await this.lifecycle.proposeEnd(token, commandId as string, worldId);
      if (row?.outcome === 'PROPOSED' || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  /**
   * Adding a member or bringing a former member back by the target's CURRENT Shared ID. The one answer for every
   * well-formed Shared ID is SUBMITTED: nothing about the target — who, whether they exist, whether they are already a
   * member — is ever returned.
   */
  async proposeMember(token: string, worldId: string, body: unknown): Promise<{ readonly outcome: 'SUBMITTED' | 'INVALID_SHARED_ID' | 'UNAVAILABLE' }> {
    const value = commandOf(body, ['commandId', 'sharedId']);
    if (typeof value.sharedId !== 'string' || value.sharedId.length > SHARED_ID_INPUT_MAX) invalid();
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      const [row] = await this.lifecycle.proposeMember(token, value.commandId as string, worldId, value.sharedId as string);
      if (row?.outcome === 'SUBMITTED' || row?.outcome === 'INVALID_SHARED_ID' || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  /** The exact target's own acceptance of an add / rejoin; the database re-proves the Shared-ID epoch binding. */
  async acceptMembershipRequest(token: string, worldId: string, requestId: string, body: unknown): Promise<{ readonly outcome: 'JOINED' | 'UNAVAILABLE' }> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!isUuid(worldId) || !isUuid(requestId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      const [row] = await this.lifecycle.acceptMembershipRequest(token, commandId as string, worldId, requestId);
      if (row?.outcome === 'JOINED' || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  async approve(token: string, worldId: string, proposalId: string, body: unknown): Promise<{ readonly outcome: 'APPROVED' | 'COMMITTED' | 'INVITED' | 'STALE' | 'UNAVAILABLE' }> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!isUuid(worldId) || !isUuid(proposalId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      const [row] = await this.lifecycle.approve(token, commandId as string, worldId, proposalId);
      if (row?.outcome === 'APPROVED' || row?.outcome === 'COMMITTED' || row?.outcome === 'INVITED' || row?.outcome === 'STALE'
        || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  historyCandidates(token: string, worldId: string, memberHandle: string, materialId?: string, establishedAt?: string): Promise<SharedHistoryCandidatesView> {
    let before: SharedLifecycleCursor | null = null;
    if (materialId !== undefined || establishedAt !== undefined) {
      try {
        before = cursorOf(materialId ?? '', establishedAt ?? '');
      } catch (error) {
        return Promise.reject(error);
      }
    }
    if (!isUuid(worldId) || !isUuid(memberHandle)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      if (!(await this.allowed(token, worldId))) return { outcome: 'UNAVAILABLE' };
      const rows = await this.lifecycle.historyCandidates(token, worldId, memberHandle, before, SHARED_LIFECYCLE_PAGE + 1);
      if (rows.some((r) => !isUuid(r.material_id) || typeof r.text_body !== 'string' || typeof r.is_self !== 'boolean')) return unavailable();
      // Newest first from the read; oldest first for reading.
      return {
        outcome: 'ALLOW',
        candidates: rows.slice(0, SHARED_LIFECYCLE_PAGE).reverse()
          .map((r) => ({ materialId: r.material_id, self: r.is_self, authorName: r.is_self ? null : r.author_name ?? null, text: r.text_body, establishedAt: r.established_at })),
        hasOlder: rows.length > SHARED_LIFECYCLE_PAGE,
      };
    });
  }

  /** The history packages, in Worlds the reader left, that wait on the reader's surviving material authority. */
  formerHistoryRequests(token: string): Promise<{ readonly requests: readonly SharedFormerHistoryRequestView[] }> {
    return this.guard(async () => {
      const requests = formerRequestsOf(await this.lifecycle.formerHistoryRequests(token));
      if (requests === null) return unavailable();
      return { requests };
    });
  }

  async proposeHistoryShare(token: string, worldId: string, body: unknown): Promise<{ readonly outcome: 'PROPOSED' | 'UNAVAILABLE' }> {
    const value = commandOf(body, ['commandId', 'memberHandle', 'materialIds']);
    const ids = value.materialIds;
    if (!isUuid(value.memberHandle) || !Array.isArray(ids) || ids.length === 0 || ids.length > SHARED_HISTORY_PACKAGE_MAX
      || !ids.every(isUuid) || new Set(ids.map((id) => (id as string).toLowerCase())).size !== ids.length) invalid();
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      const [row] = await this.lifecycle.proposeHistoryShare(token, value.commandId as string, worldId, value.memberHandle as string, ids as string[]);
      if (row?.outcome === 'PROPOSED' || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  async approveHistoryShare(token: string, worldId: string, packageId: string, body: unknown): Promise<{ readonly outcome: 'APPROVED' | 'GRANTED' | 'STALE' | 'UNAVAILABLE' }> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!isUuid(worldId) || !isUuid(packageId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      const [row] = await this.lifecycle.approveHistoryShare(token, commandId as string, worldId, packageId);
      if (row?.outcome === 'APPROVED' || row?.outcome === 'GRANTED' || row?.outcome === 'STALE' || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  /** A closed World the reader holds a closed-view entitlement for: its label, then one page of entitled material. */
  closedWorld(token: string, worldId: string, materialId?: string, establishedAt?: string): Promise<SharedClosedWorldView> {
    let before: SharedLifecycleCursor | null = null;
    if (materialId !== undefined || establishedAt !== undefined) {
      try {
        before = cursorOf(materialId ?? '', establishedAt ?? '');
      } catch (error) {
        return Promise.reject(error);
      }
    }
    if (!isUuid(worldId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      const [worlds, people] = await Promise.all([this.lifecycle.closedWorlds(token), this.lifecycle.closedMembers(token)]);
      const world = worlds.find((w) => w.world_id === worldId);
      if (world === undefined) return { outcome: 'UNAVAILABLE' };
      const rows = await this.lifecycle.closedMaterial(token, worldId, before, SHARED_LIFECYCLE_PAGE + 1);
      const materials = rows.slice(0, SHARED_LIFECYCLE_PAGE).map(closedMaterialOf);
      if (materials.some((m) => m === null)) return unavailable();
      return {
        outcome: 'ALLOW',
        world: {
          worldId, name: world.world_name,
          members: people.filter((p) => p.world_id === worldId).map((p) => ({ name: p.member_name, self: p.is_self === true })),
        },
        materials: (materials as SharedClosedMaterialView[]).reverse(),
        hasOlder: rows.length > SHARED_LIFECYCLE_PAGE,
      };
    });
  }

  /** The reader's own words in Worlds they no longer belong to: newest first, one bounded page. Nothing else. */
  ownMaterial(token: string, materialId?: string, establishedAt?: string): Promise<SharedOwnMaterialPageView> {
    let before: SharedLifecycleCursor | null = null;
    if (materialId !== undefined || establishedAt !== undefined) {
      try {
        before = cursorOf(materialId ?? '', establishedAt ?? '');
      } catch (error) {
        return Promise.reject(error);
      }
    }
    return this.guard(async () => {
      const rows = await this.lifecycle.formerMaterial(token, before, SHARED_LIFECYCLE_PAGE + 1);
      if (rows.some((r) => !isUuid(r.material_id) || !isUuid(r.world_id) || typeof r.text_body !== 'string')) return unavailable();
      return {
        materials: rows.slice(0, SHARED_LIFECYCLE_PAGE).map((r) => ({ materialId: r.material_id, worldId: r.world_id, text: r.text_body, establishedAt: r.established_at })),
        hasOlder: rows.length > SHARED_LIFECYCLE_PAGE,
      };
    });
  }

  async deleteOwnMaterial(token: string, worldId: string, materialId: string, body: unknown): Promise<{ readonly outcome: 'DELETED' | 'UNAVAILABLE' }> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!isUuid(worldId) || !isUuid(materialId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      const [row] = await this.lifecycle.deleteOwnFormer(token, commandId as string, worldId, materialId);
      if (row?.outcome === 'DELETED' || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }
}
