/**
 * S4-01 — the client for the «العالم المشترك» / Shared World Product routes.
 *
 *   GET  /shared                                   — the root: current Worlds, incoming invitations, capability hints
 *   GET  /shared/identity                          — the reader's own Shared ID (provisioned by the server on first read)
 *   POST /shared/identity/regenerate               — { commandId }
 *   POST /shared/invitations                       — { commandId, sharedId } → one non-enumerating outcome
 *   POST /shared/invitations/:id/accept|decline    — { commandId }
 *   GET  /shared/worlds/:worldId                   — the entry verdict, then the World shell
 *
 * S4-02 — the Shared conversation:
 *
 *   GET  /shared/worlds/:worldId/materials[/before/:materialId/:establishedAt] — the entry verdict, then one bounded
 *                                                                page: the newest, or the page older than the oldest held
 *   POST /shared/worlds/:worldId/messages                      — { commandId, content } → the words, then QANDEEL's reply
 *   POST /shared/worlds/:worldId/materials/:materialId/delete  — { commandId } → the reader's own words only
 *
 * S4-03 — the Shared lifecycle:
 *
 *   GET  /shared/worlds/:worldId/manage                                  — the entry verdict, then Manage World
 *   POST /shared/worlds/:worldId/leave                                   — { commandId }
 *   POST /shared/worlds/:worldId/proposals/{settings|removal|end}        — the human's proposal (never an approval)
 *   POST /shared/worlds/:worldId/proposals/:proposalId/approve           — { commandId }
 *   GET  /shared/worlds/:worldId/history-shares/candidates/:memberHandle — the earlier words the reader may offer one member
 *   POST /shared/worlds/:worldId/history-shares[/:packageId/approve]     — propose / approve one exact package
 *   GET  /shared/closed/:worldId                                         — an ended World, read-only, by entitlement
 *   GET  /shared/own-material; POST /shared/own-material/:worldId/:materialId/delete — the reader's own former words
 *
 * A transport and nothing else, exactly like the Activity client: no credential of its own (the request-time seam its
 * caller hands it), no user id, no retry, no meaning. Every answer is decoded strictly; anything else is no answer.
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHARED_ID = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/u;

export interface SharedMember { readonly name: string | null; readonly self: boolean }
/** `name` (S4-03): the World's committed name, the label once committed; null keeps the S4-01 member-name label. */
export interface SharedWorldSummary { readonly worldId: string; readonly name: string | null; readonly members: readonly SharedMember[] }
export interface SharedInvitation { readonly invitationId: string; readonly inviterName: string | null }
export interface SharedRoot {
  readonly capabilities: { readonly invitation: boolean; readonly birth: boolean };
  readonly worlds: readonly SharedWorldSummary[];
  readonly invitations: readonly SharedInvitation[];
  /** S4-03: the ended Worlds the reader may read (closed-view entitlement: the members at closure). */
  readonly closedWorlds: readonly SharedWorldSummary[];
  /** S4-03: the add / rejoin requests waiting on this reader as their exact target — who proposed it, nothing of the World. */
  readonly memberRequests: readonly SharedMemberRequest[];
}
export interface SharedMemberRequest { readonly requestId: string; readonly worldId: string; readonly kind: 'ADD' | 'REJOIN'; readonly proposerName: string | null }
export type SharedRootResult = { readonly kind: 'READ'; readonly root: SharedRoot } | { readonly kind: 'UNAVAILABLE' };
export type SharedIdentityResult =
  | { readonly kind: 'READY'; readonly sharedId: string }
  /** Shared is not open yet: no Shared ID exists and none is created. */
  | { readonly kind: 'NOT_OPEN' }
  | { readonly kind: 'UNAVAILABLE' };
export type SharedInviteResult = { readonly kind: 'SUBMITTED' | 'INVALID_SHARED_ID' | 'NOT_OPEN' | 'UNAVAILABLE' };
export type SharedAcceptResult =
  | { readonly kind: 'BORN'; readonly worldId: string }
  | { readonly kind: 'NOT_OPEN' | 'NOT_ACCEPTABLE' | 'UNAVAILABLE' };
export type SharedDeclineResult = { readonly kind: 'DECLINED' | 'NOT_DECLINABLE' | 'UNAVAILABLE' };
export interface SharedWorldShell { readonly worldId: string; readonly bornAt: string; readonly name: string | null; readonly members: readonly SharedMember[] }
export type SharedEntryResult =
  | { readonly kind: 'ALLOW'; readonly world: SharedWorldShell }
  /** Denied, unknown, left or never existed — one neutral answer that reveals nothing. */
  | { readonly kind: 'DENIED' }
  | { readonly kind: 'UNAVAILABLE' };

/** One visible Shared material. Who produced it, and whether this reader may delete it, are the server's answer. */
export interface SharedMaterial {
  readonly materialId: string;
  readonly producer: 'SELF' | 'HUMAN' | 'QANDEEL';
  /** Another person's legitimate Name (HUMAN only); null otherwise. */
  readonly authorName: string | null;
  readonly text: string;
  readonly establishedAt: string;
  readonly canDelete: boolean;
}
/** The oldest material a reader holds: the next page read is strictly older than it. */
export interface SharedMaterialCursor { readonly materialId: string; readonly establishedAt: string }
export type SharedMaterialsResult =
  /** One bounded page, oldest first; `hasOlder` says whether visible material older than it exists. */
  | { readonly kind: 'READ'; readonly conversation: boolean; readonly materials: readonly SharedMaterial[]; readonly hasOlder: boolean }
  /** Not this reader's World now — one neutral answer that reveals nothing. */
  | { readonly kind: 'DENIED' }
  | { readonly kind: 'UNAVAILABLE' };
export type SharedSendResult =
  /**
   * The words are committed; QANDEEL's reply is its own outcome: COMMITTED, PENDING (another request for this same
   * message is still producing it, so it appears on the next read) or UNAVAILABLE (no reply was committed).
   */
  | { readonly kind: 'COMMITTED'; readonly materialId: string; readonly qandeel: 'COMMITTED' | 'PENDING' | 'UNAVAILABLE' }
  /** The server definitively refused: conversation closed, or not a current member. Nothing was committed. */
  | { readonly kind: 'NOT_AVAILABLE' }
  /** No answer: the outcome is unknown, so the same command is retried. */
  | { readonly kind: 'UNAVAILABLE' };
export type SharedDeleteResult = { readonly kind: 'DELETED' | 'NOT_DELETABLE' | 'UNAVAILABLE' };

// --- S4-03 ------------------------------------------------------------------------------------------------------------
export interface SharedSettingsValues { readonly name: string | null; readonly description: string | null; readonly topic: string | null }
/** One current member as Manage World knows them: an opaque handle the server re-resolves, never a user id. */
export interface SharedLifecycleMember { readonly handle: string; readonly name: string | null; readonly self: boolean }
export interface SharedProposal {
  readonly proposalId: string;
  readonly kind: 'SETTINGS' | 'REMOVAL' | 'END' | 'ADD' | 'REJOIN';
  /** Who proposed it — no authority comes with it. */
  readonly proposer: { readonly name: string | null; readonly self: boolean };
  /** A removal's target (a current member, by their own Name); never an add / rejoin target. */
  readonly targetName: string | null;
  readonly settings: SharedSettingsValues | null;
  /** Whether THIS reader approved. Who else approved is never shown — only the neutral progress. */
  readonly approvedBySelf: boolean;
  readonly progress: { readonly approved: number; readonly required: number };
}
export interface SharedHistoryRequest {
  readonly packageId: string;
  readonly granteeName: string | null;
  readonly approvedBySelf: boolean;
  /** Exactly the reader's own words in the package. */
  readonly items: readonly { readonly materialId: string; readonly text: string; readonly establishedAt: string }[];
}
export interface SharedManage {
  readonly capabilities: { readonly governance: boolean; readonly history: boolean };
  readonly settings: SharedSettingsValues;
  readonly members: readonly SharedLifecycleMember[];
  readonly proposals: readonly SharedProposal[];
  readonly historyRequests: readonly SharedHistoryRequest[];
}
export type SharedManageResult = { readonly kind: 'READ'; readonly manage: SharedManage } | { readonly kind: 'DENIED' } | { readonly kind: 'UNAVAILABLE' };
export interface SharedHistoryCandidate { readonly materialId: string; readonly self: boolean; readonly authorName: string | null; readonly text: string; readonly establishedAt: string }
export type SharedHistoryCandidatesResult =
  | { readonly kind: 'READ'; readonly candidates: readonly SharedHistoryCandidate[]; readonly hasOlder: boolean }
  | { readonly kind: 'DENIED' }
  | { readonly kind: 'UNAVAILABLE' };
/** REFUSED: the server's one bounded answer (nothing happened). UNAVAILABLE: no answer — the same command is retried. */
export type SharedLeaveResult = { readonly kind: 'LEFT' | 'REFUSED' | 'UNAVAILABLE' };
export type SharedProposeResult = { readonly kind: 'PROPOSED' | 'UNCHANGED' | 'REFUSED' | 'UNAVAILABLE' };
export type SharedApproveResult = { readonly kind: 'APPROVED' | 'COMMITTED' | 'INVITED' | 'STALE' | 'REFUSED' | 'UNAVAILABLE' };
/** One answer for every well-formed Shared ID: nothing about the target ever comes back. */
export type SharedProposeMemberResult = { readonly kind: 'SUBMITTED' | 'INVALID_SHARED_ID' | 'REFUSED' | 'UNAVAILABLE' };
export type SharedJoinResult = { readonly kind: 'JOINED' | 'REFUSED' | 'UNAVAILABLE' };
/** A former member's surviving material authority: exactly their own words in one package, nothing of the World. */
export interface SharedFormerHistoryRequest {
  readonly packageId: string;
  readonly worldId: string;
  readonly approvedBySelf: boolean;
  readonly items: readonly { readonly materialId: string; readonly text: string; readonly establishedAt: string }[];
}
export type SharedFormerHistoryResult = { readonly kind: 'READ'; readonly requests: readonly SharedFormerHistoryRequest[] } | { readonly kind: 'UNAVAILABLE' };
export type SharedHistoryApproveResult = { readonly kind: 'APPROVED' | 'GRANTED' | 'STALE' | 'REFUSED' | 'UNAVAILABLE' };
export interface SharedClosedWorld {
  readonly worldId: string;
  readonly name: string | null;
  readonly members: readonly SharedMember[];
  readonly materials: readonly SharedMaterial[];
  readonly hasOlder: boolean;
}
export type SharedClosedWorldResult = { readonly kind: 'READ'; readonly world: SharedClosedWorld } | { readonly kind: 'DENIED' } | { readonly kind: 'UNAVAILABLE' };
export interface SharedOwnMaterial { readonly materialId: string; readonly worldId: string; readonly text: string; readonly establishedAt: string }
export type SharedOwnMaterialResult = { readonly kind: 'READ'; readonly materials: readonly SharedOwnMaterial[]; readonly hasOlder: boolean } | { readonly kind: 'UNAVAILABLE' };

const PROPOSAL_KINDS = ['SETTINGS', 'REMOVAL', 'END', 'ADD', 'REJOIN'] as const;
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
function decodeOwnItems(value: unknown): SharedHistoryRequest['items'][number][] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items: SharedHistoryRequest['items'][number][] = [];
  for (const i of value) {
    if (!isRecord(i) || !hasExactly(i, ['materialId', 'text', 'establishedAt']) || typeof i.materialId !== 'string' || !UUID.test(i.materialId)
      || typeof i.text !== 'string' || typeof i.establishedAt !== 'string') return null;
    items.push({ materialId: i.materialId, text: i.text, establishedAt: i.establishedAt });
  }
  return items;
}
const textOrNull = (value: unknown): string | null | undefined => (value === null ? null : typeof value === 'string' && value.length <= 600 ? value : undefined);
function decodeSettings(value: unknown): SharedSettingsValues | null {
  if (!isRecord(value) || !hasExactly(value, ['name', 'description', 'topic'])) return null;
  const name = textOrNull(value.name);
  const description = textOrNull(value.description);
  const topic = textOrNull(value.topic);
  return name === undefined || description === undefined || topic === undefined ? null : { name, description, topic };
}
export function decodeSharedManage(body: unknown): SharedManageResult {
  if (!isRecord(body)) return { kind: 'UNAVAILABLE' };
  if (hasExactly(body, ['outcome']) && body.outcome === 'UNAVAILABLE') return { kind: 'DENIED' };
  if (body.outcome !== 'ALLOW' || !hasExactly(body, ['outcome', 'capabilities', 'settings', 'members', 'proposals', 'historyRequests'])) return { kind: 'UNAVAILABLE' };
  const c = body.capabilities;
  if (!isRecord(c) || !hasExactly(c, ['governance', 'history']) || typeof c.governance !== 'boolean' || typeof c.history !== 'boolean') return { kind: 'UNAVAILABLE' };
  const settings = decodeSettings(body.settings);
  if (settings === null || !Array.isArray(body.members) || !Array.isArray(body.proposals) || !Array.isArray(body.historyRequests)) return { kind: 'UNAVAILABLE' };
  const members: SharedLifecycleMember[] = [];
  for (const m of body.members) {
    if (!isRecord(m) || !hasExactly(m, ['handle', 'name', 'self']) || typeof m.handle !== 'string' || !UUID.test(m.handle) || typeof m.self !== 'boolean') return { kind: 'UNAVAILABLE' };
    const name = nameOf(m.name);
    if (name === undefined) return { kind: 'UNAVAILABLE' };
    members.push({ handle: m.handle, name, self: m.self });
  }
  const proposals: SharedProposal[] = [];
  for (const p of body.proposals) {
    if (!isRecord(p) || !hasExactly(p, ['proposalId', 'kind', 'proposer', 'targetName', 'settings', 'approvedBySelf', 'progress'])
      || typeof p.proposalId !== 'string' || !UUID.test(p.proposalId) || !PROPOSAL_KINDS.includes(p.kind as never) || typeof p.approvedBySelf !== 'boolean') return { kind: 'UNAVAILABLE' };
    const proposer = p.proposer;
    const progress = p.progress;
    if (!isRecord(proposer) || !hasExactly(proposer, ['name', 'self']) || typeof proposer.self !== 'boolean'
      || !isRecord(progress) || !hasExactly(progress, ['approved', 'required']) || !isCount(progress.approved) || !isCount(progress.required)
      || progress.required === 0 || progress.approved > progress.required) return { kind: 'UNAVAILABLE' };
    const proposerName = nameOf(proposer.name);
    const targetName = nameOf(p.targetName);
    const proposed = p.settings === null ? null : decodeSettings(p.settings);
    if (proposerName === undefined || targetName === undefined || (p.kind === 'SETTINGS') !== (proposed !== null)) return { kind: 'UNAVAILABLE' };
    proposals.push({
      proposalId: p.proposalId, kind: p.kind as SharedProposal['kind'], proposer: { name: proposer.self ? null : proposerName, self: proposer.self },
      targetName: p.kind === 'REMOVAL' ? targetName : null, settings: proposed, approvedBySelf: p.approvedBySelf,
      progress: { approved: progress.approved, required: progress.required },
    });
  }
  const historyRequests: SharedHistoryRequest[] = [];
  for (const r of body.historyRequests) {
    if (!isRecord(r) || !hasExactly(r, ['packageId', 'granteeName', 'approvedBySelf', 'items']) || typeof r.packageId !== 'string' || !UUID.test(r.packageId)
      || typeof r.approvedBySelf !== 'boolean' || !Array.isArray(r.items) || r.items.length === 0) return { kind: 'UNAVAILABLE' };
    const granteeName = nameOf(r.granteeName);
    const items = decodeOwnItems(r.items);
    if (granteeName === undefined || items === null) return { kind: 'UNAVAILABLE' };
    historyRequests.push({ packageId: r.packageId, granteeName, approvedBySelf: r.approvedBySelf, items });
  }
  return { kind: 'READ', manage: { capabilities: { governance: c.governance, history: c.history }, settings, members, proposals, historyRequests } };
}
export function decodeSharedClosedWorld(body: unknown, worldId: string): SharedClosedWorldResult {
  if (!isRecord(body)) return { kind: 'UNAVAILABLE' };
  if (hasExactly(body, ['outcome']) && body.outcome === 'UNAVAILABLE') return { kind: 'DENIED' };
  if (body.outcome !== 'ALLOW' || !hasExactly(body, ['outcome', 'world', 'materials', 'hasOlder']) || !isRecord(body.world) || typeof body.hasOlder !== 'boolean') return { kind: 'UNAVAILABLE' };
  const w = body.world;
  if (!hasExactly(w, ['worldId', 'name', 'members']) || w.worldId !== worldId) return { kind: 'UNAVAILABLE' };
  const name = nameOf(w.name);
  const members = decodeMembers(w.members);
  // The closed page has the material shape of the ordinary read, read-only: nothing in it is deletable here.
  const page = decodeSharedMaterials({ outcome: 'ALLOW', conversation: false, hasOlder: body.hasOlder,
    materials: Array.isArray(body.materials) ? body.materials.map((m) => (isRecord(m) ? { ...m, canDelete: false } : m)) : null });
  if (name === undefined || members === null || page.kind !== 'READ') return { kind: 'UNAVAILABLE' };
  return { kind: 'READ', world: { worldId, name, members, materials: page.materials, hasOlder: page.hasOlder } };
}

const MATERIAL_KEYS = ['materialId', 'producer', 'authorName', 'text', 'establishedAt', 'canDelete'] as const;
export function decodeSharedMaterials(body: unknown): SharedMaterialsResult {
  if (!isRecord(body)) return { kind: 'UNAVAILABLE' };
  if (hasExactly(body, ['outcome']) && body.outcome === 'UNAVAILABLE') return { kind: 'DENIED' };
  if (body.outcome !== 'ALLOW' || !hasExactly(body, ['outcome', 'conversation', 'materials', 'hasOlder']) || typeof body.conversation !== 'boolean'
    || typeof body.hasOlder !== 'boolean' || !Array.isArray(body.materials)) {
    return { kind: 'UNAVAILABLE' };
  }
  const materials: SharedMaterial[] = [];
  for (const m of body.materials) {
    if (!isRecord(m) || !hasExactly(m, MATERIAL_KEYS) || typeof m.materialId !== 'string' || !UUID.test(m.materialId)) return { kind: 'UNAVAILABLE' };
    if ((m.producer !== 'SELF' && m.producer !== 'HUMAN' && m.producer !== 'QANDEEL') || typeof m.text !== 'string' || typeof m.establishedAt !== 'string' || typeof m.canDelete !== 'boolean') {
      return { kind: 'UNAVAILABLE' };
    }
    const authorName = nameOf(m.authorName);
    if (authorName === undefined) return { kind: 'UNAVAILABLE' };
    // Only the reader's own words are ever deletable; a contradictory answer is no answer.
    if (m.canDelete && m.producer !== 'SELF') return { kind: 'UNAVAILABLE' };
    materials.push({ materialId: m.materialId, producer: m.producer, authorName: m.producer === 'HUMAN' ? authorName : null, text: m.text, establishedAt: m.establishedAt, canDelete: m.canDelete });
  }
  return { kind: 'READ', conversation: body.conversation, materials, hasOlder: body.hasOlder };
}

export interface SharedWorldApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]) => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};
const nameOf = (value: unknown): string | null | undefined => (value === null ? null : typeof value === 'string' && value.length <= 200 ? value : undefined);

function decodeMembers(value: unknown): SharedMember[] | null {
  if (!Array.isArray(value)) return null;
  const out: SharedMember[] = [];
  for (const m of value) {
    if (!isRecord(m) || !hasExactly(m, ['name', 'self']) || typeof m.self !== 'boolean') return null;
    const name = nameOf(m.name);
    if (name === undefined) return null;
    out.push({ name, self: m.self });
  }
  return out;
}

export function decodeSharedRoot(body: unknown): SharedRoot | null {
  if (!isRecord(body) || !hasExactly(body, ['capabilities', 'worlds', 'invitations', 'closedWorlds', 'memberRequests'])) return null;
  const c = body.capabilities;
  if (!isRecord(c) || !hasExactly(c, ['invitation', 'birth']) || typeof c.invitation !== 'boolean' || typeof c.birth !== 'boolean') return null;
  if (!Array.isArray(body.worlds) || !Array.isArray(body.invitations)) return null;
  const worlds = decodeWorldList(body.worlds);
  const closedWorlds = decodeWorldList(body.closedWorlds);
  if (worlds === null || closedWorlds === null) return null;
  const invitations: SharedInvitation[] = [];
  for (const i of body.invitations) {
    if (!isRecord(i) || !hasExactly(i, ['invitationId', 'inviterName']) || typeof i.invitationId !== 'string' || !UUID.test(i.invitationId)) return null;
    const inviterName = nameOf(i.inviterName);
    if (inviterName === undefined) return null;
    invitations.push({ invitationId: i.invitationId, inviterName });
  }
  if (!Array.isArray(body.memberRequests)) return null;
  const memberRequests: SharedMemberRequest[] = [];
  for (const r of body.memberRequests) {
    if (!isRecord(r) || !hasExactly(r, ['requestId', 'worldId', 'kind', 'proposerName']) || typeof r.requestId !== 'string' || !UUID.test(r.requestId)
      || typeof r.worldId !== 'string' || !UUID.test(r.worldId) || (r.kind !== 'ADD' && r.kind !== 'REJOIN')) return null;
    const proposerName = nameOf(r.proposerName);
    if (proposerName === undefined) return null;
    memberRequests.push({ requestId: r.requestId, worldId: r.worldId, kind: r.kind, proposerName });
  }
  return { capabilities: { invitation: c.invitation, birth: c.birth }, worlds, invitations, closedWorlds, memberRequests };
}

function decodeWorldList(value: unknown): SharedWorldSummary[] | null {
  if (!Array.isArray(value)) return null;
  const worlds: SharedWorldSummary[] = [];
  for (const w of value) {
    if (!isRecord(w) || !hasExactly(w, ['worldId', 'name', 'members']) || typeof w.worldId !== 'string' || !UUID.test(w.worldId)) return null;
    const name = nameOf(w.name);
    const members = decodeMembers(w.members);
    if (name === undefined || members === null) return null;
    worlds.push({ worldId: w.worldId, name, members });
  }
  return worlds;
}

type Exchange = { readonly kind: 'OK'; readonly body: unknown } | { readonly kind: 'STATUS'; readonly status: number } | { readonly kind: 'NETWORK' };

export class SharedWorldApiClient {
  constructor(private readonly config: SharedWorldApiConfig) {}

  async root(): Promise<SharedRootResult> {
    const answer = await this.exchange('GET', '/shared');
    const root = answer.kind === 'OK' ? decodeSharedRoot(answer.body) : null;
    return root === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', root };
  }

  identity(): Promise<SharedIdentityResult> {
    return this.identityAnswer(this.exchange('GET', '/shared/identity'));
  }

  regenerate(commandId: string): Promise<SharedIdentityResult> {
    return this.identityAnswer(this.exchange('POST', '/shared/identity/regenerate', { commandId }));
  }

  async invite(commandId: string, sharedId: string): Promise<SharedInviteResult> {
    const outcome = await this.outcome(this.exchange('POST', '/shared/invitations', { commandId, sharedId }));
    if (outcome === 'SUBMITTED' || outcome === 'INVALID_SHARED_ID') return { kind: outcome };
    return { kind: outcome === 'UNAVAILABLE' ? 'NOT_OPEN' : 'UNAVAILABLE' };
  }

  async accept(invitationId: string, commandId: string): Promise<SharedAcceptResult> {
    const answer = await this.exchange('POST', `/shared/invitations/${encodeURIComponent(invitationId)}/accept`, { commandId });
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return { kind: 'UNAVAILABLE' };
    const body = answer.body;
    if (body.outcome === 'BORN' && hasExactly(body, ['outcome', 'worldId']) && typeof body.worldId === 'string' && UUID.test(body.worldId)) {
      return { kind: 'BORN', worldId: body.worldId };
    }
    if (hasExactly(body, ['outcome']) && body.outcome === 'NOT_ACCEPTABLE') return { kind: 'NOT_ACCEPTABLE' };
    if (hasExactly(body, ['outcome']) && body.outcome === 'UNAVAILABLE') return { kind: 'NOT_OPEN' };
    return { kind: 'UNAVAILABLE' };
  }

  async decline(invitationId: string, commandId: string): Promise<SharedDeclineResult> {
    const outcome = await this.outcome(this.exchange('POST', `/shared/invitations/${encodeURIComponent(invitationId)}/decline`, { commandId }));
    return { kind: outcome === 'DECLINED' || outcome === 'NOT_DECLINABLE' ? outcome : 'UNAVAILABLE' };
  }

  async entry(worldId: string): Promise<SharedEntryResult> {
    const answer = await this.exchange('GET', `/shared/worlds/${encodeURIComponent(worldId)}`);
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return { kind: 'UNAVAILABLE' };
    const body = answer.body;
    if (hasExactly(body, ['outcome']) && body.outcome === 'UNAVAILABLE') return { kind: 'DENIED' };
    if (body.outcome !== 'ALLOW' || !hasExactly(body, ['outcome', 'world']) || !isRecord(body.world)) return { kind: 'UNAVAILABLE' };
    const w = body.world;
    if (!hasExactly(w, ['worldId', 'bornAt', 'name', 'members']) || w.worldId !== worldId || typeof w.bornAt !== 'string') return { kind: 'UNAVAILABLE' };
    const members = decodeMembers(w.members);
    const name = nameOf(w.name);
    return members === null || name === undefined ? { kind: 'UNAVAILABLE' } : { kind: 'ALLOW', world: { worldId, bornAt: w.bornAt, name, members } };
  }

  async materials(worldId: string, before: SharedMaterialCursor | null = null): Promise<SharedMaterialsResult> {
    const page = before === null ? '' : `/before/${encodeURIComponent(before.materialId)}/${encodeURIComponent(before.establishedAt)}`;
    const answer = await this.exchange('GET', `/shared/worlds/${encodeURIComponent(worldId)}/materials${page}`);
    return answer.kind === 'OK' ? decodeSharedMaterials(answer.body) : { kind: 'UNAVAILABLE' };
  }

  async send(worldId: string, commandId: string, content: string): Promise<SharedSendResult> {
    const answer = await this.exchange('POST', `/shared/worlds/${encodeURIComponent(worldId)}/messages`, { commandId, content });
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return { kind: 'UNAVAILABLE' };
    const body = answer.body;
    if (body.outcome === 'COMMITTED' && hasExactly(body, ['outcome', 'materialId', 'qandeel']) && typeof body.materialId === 'string' && UUID.test(body.materialId)
      && (body.qandeel === 'COMMITTED' || body.qandeel === 'PENDING' || body.qandeel === 'UNAVAILABLE')) {
      return { kind: 'COMMITTED', materialId: body.materialId, qandeel: body.qandeel };
    }
    if (hasExactly(body, ['outcome']) && body.outcome === 'UNAVAILABLE') return { kind: 'NOT_AVAILABLE' };
    return { kind: 'UNAVAILABLE' };
  }

  async deleteMaterial(worldId: string, materialId: string, commandId: string): Promise<SharedDeleteResult> {
    const outcome = await this.outcome(this.exchange('POST', `/shared/worlds/${encodeURIComponent(worldId)}/materials/${encodeURIComponent(materialId)}/delete`, { commandId }));
    return { kind: outcome === 'DELETED' ? 'DELETED' : outcome === 'UNAVAILABLE' ? 'NOT_DELETABLE' : 'UNAVAILABLE' };
  }

  // --- S4-03 ----------------------------------------------------------------------------------------------------------
  async manage(worldId: string): Promise<SharedManageResult> {
    const answer = await this.exchange('GET', `/shared/worlds/${encodeURIComponent(worldId)}/manage`);
    return answer.kind === 'OK' ? decodeSharedManage(answer.body) : { kind: 'UNAVAILABLE' };
  }

  async leave(worldId: string, commandId: string): Promise<SharedLeaveResult> {
    const outcome = await this.outcome(this.exchange('POST', `/shared/worlds/${encodeURIComponent(worldId)}/leave`, { commandId }));
    return { kind: outcome === 'LEFT' ? 'LEFT' : outcome === 'UNAVAILABLE' ? 'REFUSED' : 'UNAVAILABLE' };
  }

  proposeSettings(worldId: string, commandId: string, values: { readonly name: string; readonly description: string; readonly topic: string }): Promise<SharedProposeResult> {
    return this.proposal(`/shared/worlds/${encodeURIComponent(worldId)}/proposals/settings`, { commandId, name: values.name, description: values.description, topic: values.topic });
  }

  proposeRemoval(worldId: string, commandId: string, memberHandle: string): Promise<SharedProposeResult> {
    return this.proposal(`/shared/worlds/${encodeURIComponent(worldId)}/proposals/removal`, { commandId, memberHandle });
  }

  proposeEnd(worldId: string, commandId: string): Promise<SharedProposeResult> {
    return this.proposal(`/shared/worlds/${encodeURIComponent(worldId)}/proposals/end`, { commandId });
  }

  /** Adding a member, or bringing a former one back, by the target's CURRENT Shared ID. */
  async proposeMember(worldId: string, commandId: string, sharedId: string): Promise<SharedProposeMemberResult> {
    const outcome = await this.outcome(this.exchange('POST', `/shared/worlds/${encodeURIComponent(worldId)}/proposals/member`, { commandId, sharedId }));
    if (outcome === 'SUBMITTED' || outcome === 'INVALID_SHARED_ID') return { kind: outcome };
    return { kind: outcome === 'UNAVAILABLE' ? 'REFUSED' : 'UNAVAILABLE' };
  }

  /** The exact target's own acceptance of an add / rejoin request. */
  async acceptMembershipRequest(worldId: string, requestId: string, commandId: string): Promise<SharedJoinResult> {
    const outcome = await this.outcome(this.exchange('POST', `/shared/membership-requests/${encodeURIComponent(worldId)}/${encodeURIComponent(requestId)}/accept`, { commandId }));
    return { kind: outcome === 'JOINED' ? 'JOINED' : outcome === 'UNAVAILABLE' ? 'REFUSED' : 'UNAVAILABLE' };
  }

  async approve(worldId: string, proposalId: string, commandId: string): Promise<SharedApproveResult> {
    const outcome = await this.outcome(this.exchange('POST', `/shared/worlds/${encodeURIComponent(worldId)}/proposals/${encodeURIComponent(proposalId)}/approve`, { commandId }));
    if (outcome === 'APPROVED' || outcome === 'COMMITTED' || outcome === 'INVITED' || outcome === 'STALE') return { kind: outcome };
    return { kind: outcome === 'UNAVAILABLE' ? 'REFUSED' : 'UNAVAILABLE' };
  }

  async historyCandidates(worldId: string, memberHandle: string, before: SharedMaterialCursor | null = null): Promise<SharedHistoryCandidatesResult> {
    const page = before === null ? '' : `/before/${encodeURIComponent(before.materialId)}/${encodeURIComponent(before.establishedAt)}`;
    const answer = await this.exchange('GET', `/shared/worlds/${encodeURIComponent(worldId)}/history-shares/candidates/${encodeURIComponent(memberHandle)}${page}`);
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return { kind: 'UNAVAILABLE' };
    const body = answer.body;
    if (hasExactly(body, ['outcome']) && body.outcome === 'UNAVAILABLE') return { kind: 'DENIED' };
    if (body.outcome !== 'ALLOW' || !hasExactly(body, ['outcome', 'candidates', 'hasOlder']) || !Array.isArray(body.candidates)
      || typeof body.hasOlder !== 'boolean') return { kind: 'UNAVAILABLE' };
    const candidates: SharedHistoryCandidate[] = [];
    for (const c of body.candidates) {
      if (!isRecord(c) || !hasExactly(c, ['materialId', 'self', 'authorName', 'text', 'establishedAt']) || typeof c.materialId !== 'string' || !UUID.test(c.materialId)
        || typeof c.self !== 'boolean' || typeof c.text !== 'string' || typeof c.establishedAt !== 'string') return { kind: 'UNAVAILABLE' };
      const authorName = nameOf(c.authorName);
      if (authorName === undefined) return { kind: 'UNAVAILABLE' };
      candidates.push({ materialId: c.materialId, self: c.self, authorName: c.self ? null : authorName, text: c.text, establishedAt: c.establishedAt });
    }
    return { kind: 'READ', candidates, hasOlder: body.hasOlder };
  }

  proposeHistoryShare(worldId: string, commandId: string, memberHandle: string, materialIds: readonly string[]): Promise<SharedProposeResult> {
    return this.proposal(`/shared/worlds/${encodeURIComponent(worldId)}/history-shares`, { commandId, memberHandle, materialIds: [...materialIds] });
  }

  async approveHistoryShare(worldId: string, packageId: string, commandId: string): Promise<SharedHistoryApproveResult> {
    const outcome = await this.outcome(this.exchange('POST', `/shared/worlds/${encodeURIComponent(worldId)}/history-shares/${encodeURIComponent(packageId)}/approve`, { commandId }));
    if (outcome === 'APPROVED' || outcome === 'GRANTED' || outcome === 'STALE') return { kind: outcome };
    return { kind: outcome === 'UNAVAILABLE' ? 'REFUSED' : 'UNAVAILABLE' };
  }

  async closedWorld(worldId: string, before: SharedMaterialCursor | null = null): Promise<SharedClosedWorldResult> {
    const page = before === null ? '' : `/before/${encodeURIComponent(before.materialId)}/${encodeURIComponent(before.establishedAt)}`;
    const answer = await this.exchange('GET', `/shared/closed/${encodeURIComponent(worldId)}${page}`);
    return answer.kind === 'OK' ? decodeSharedClosedWorld(answer.body, worldId) : { kind: 'UNAVAILABLE' };
  }

  async ownMaterial(before: SharedMaterialCursor | null = null): Promise<SharedOwnMaterialResult> {
    const page = before === null ? '' : `/before/${encodeURIComponent(before.materialId)}/${encodeURIComponent(before.establishedAt)}`;
    const answer = await this.exchange('GET', `/shared/own-material${page}`);
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['materials', 'hasOlder']) || !Array.isArray(answer.body.materials)
      || typeof answer.body.hasOlder !== 'boolean') return { kind: 'UNAVAILABLE' };
    const materials: SharedOwnMaterial[] = [];
    for (const m of answer.body.materials) {
      if (!isRecord(m) || !hasExactly(m, ['materialId', 'worldId', 'text', 'establishedAt']) || typeof m.materialId !== 'string' || !UUID.test(m.materialId)
        || typeof m.worldId !== 'string' || !UUID.test(m.worldId) || typeof m.text !== 'string' || typeof m.establishedAt !== 'string') return { kind: 'UNAVAILABLE' };
      materials.push({ materialId: m.materialId, worldId: m.worldId, text: m.text, establishedAt: m.establishedAt });
    }
    return { kind: 'READ', materials, hasOlder: answer.body.hasOlder };
  }

  /** The history packages, in Worlds the reader left, that wait on the reader's surviving material authority. */
  async formerHistoryRequests(): Promise<SharedFormerHistoryResult> {
    const answer = await this.exchange('GET', '/shared/own-material/history-shares');
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['requests']) || !Array.isArray(answer.body.requests)) return { kind: 'UNAVAILABLE' };
    const requests: SharedFormerHistoryRequest[] = [];
    for (const r of answer.body.requests) {
      if (!isRecord(r) || !hasExactly(r, ['packageId', 'worldId', 'approvedBySelf', 'items']) || typeof r.packageId !== 'string' || !UUID.test(r.packageId)
        || typeof r.worldId !== 'string' || !UUID.test(r.worldId) || typeof r.approvedBySelf !== 'boolean') return { kind: 'UNAVAILABLE' };
      const items = decodeOwnItems(r.items);
      if (items === null) return { kind: 'UNAVAILABLE' };
      requests.push({ packageId: r.packageId, worldId: r.worldId, approvedBySelf: r.approvedBySelf, items });
    }
    return { kind: 'READ', requests };
  }

  /** A former member's approval of their own included words — outside the World; nothing of it is returned. */
  async approveFormerHistoryShare(worldId: string, packageId: string, commandId: string): Promise<SharedHistoryApproveResult> {
    const outcome = await this.outcome(this.exchange('POST', `/shared/own-material/history-shares/${encodeURIComponent(worldId)}/${encodeURIComponent(packageId)}/approve`, { commandId }));
    if (outcome === 'APPROVED' || outcome === 'GRANTED' || outcome === 'STALE') return { kind: outcome };
    return { kind: outcome === 'UNAVAILABLE' ? 'REFUSED' : 'UNAVAILABLE' };
  }

  async deleteOwnMaterial(worldId: string, materialId: string, commandId: string): Promise<SharedDeleteResult> {
    const outcome = await this.outcome(this.exchange('POST', `/shared/own-material/${encodeURIComponent(worldId)}/${encodeURIComponent(materialId)}/delete`, { commandId }));
    return { kind: outcome === 'DELETED' ? 'DELETED' : outcome === 'UNAVAILABLE' ? 'NOT_DELETABLE' : 'UNAVAILABLE' };
  }

  private async proposal(path: string, payload: Record<string, unknown>): Promise<SharedProposeResult> {
    const outcome = await this.outcome(this.exchange('POST', path, payload));
    if (outcome === 'PROPOSED' || outcome === 'UNCHANGED') return { kind: outcome };
    return { kind: outcome === 'UNAVAILABLE' ? 'REFUSED' : 'UNAVAILABLE' };
  }

  private async identityAnswer(pending: Promise<Exchange>): Promise<SharedIdentityResult> {
    const answer = await pending;
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return { kind: 'UNAVAILABLE' };
    const body = answer.body;
    if (body.status === 'READY' && hasExactly(body, ['status', 'sharedId']) && typeof body.sharedId === 'string' && SHARED_ID.test(body.sharedId)) {
      return { kind: 'READY', sharedId: body.sharedId };
    }
    if (body.status === 'UNAVAILABLE' && hasExactly(body, ['status'])) return { kind: 'NOT_OPEN' };
    return { kind: 'UNAVAILABLE' };
  }

  private async outcome(pending: Promise<Exchange>): Promise<string | null> {
    const answer = await pending;
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['outcome'])) return null;
    return typeof answer.body.outcome === 'string' ? answer.body.outcome : null;
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
