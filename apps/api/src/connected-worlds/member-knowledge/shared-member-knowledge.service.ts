// S8A-04 CP3 — the server's side of Personal Knowledge in a Shared World (amendment §3 – §6, with the Product Owner's two
// binding corrections of 2026-10-25).
//
//   collect   the consented items of the members present now, at most one per owner, by the 0171 index terms of the
//             message being answered (0176 collector). Without a configured judge nothing is collected: an item that
//             could never be checked is never used, and the reply goes on exactly as before.
//   lane      the authorized-disclosure lane for one request (`shared-member-knowledge-lane.ts`).
//   names     R4-2 step 1 (0178): the Name every member of the World's exact current audience is shown, silent members
//             included, or null — read-only; a missing or ambiguous Name only means that owner's item cannot be stated.
//   coolDown  R4-3: only the items a checked reply proved unsafe rest for an hour (an operational value, §4); a failure
//             cools nothing.
//   propose   AFTER a reply is committed: the LOCAL relevance read (0176, SQL only). No model, no provider, no item words
//             leave the database before consent; its only effect is one private request row the owner alone can read
//             (Product Owner correction 1). It never delays or shapes a reply.
//
// Every method is total: a failure is "no knowledge", "no cooldown" or "no request", never a refused reply. Nothing is
// logged.

import { Inject, Injectable, Optional } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import { MAX_RETRIEVAL_QUERY_TERMS, memoryRetrievalTerms } from '../../memory/memory-retrieval-terms';
import { SharedHumanAudienceResolverService } from '../audience/shared-human-audience-resolver.service';
import { digestReasoningContent } from '../effective-context/shared-effective-context.service';
import { SharedPreModelWorldStateResolverService } from '../effective-context/shared-pre-model-world-state-resolver.service';
import type { SharedWorldId } from '../kernel/world.types';
import type { SharedClaimAudienceMember } from './shared-claim-spans';
import { SharedMemberKnowledgeLane } from './shared-member-knowledge-lane';
import {
  SHARED_AUDIENCE_NAMES_RPC, SHARED_DISCLOSURE_JUDGE, SHARED_KNOWLEDGE_COOL_DOWN_RPC, SHARED_KNOWLEDGE_FOR_REPLY_RPC, SHARED_KNOWLEDGE_PROPOSE_RPC,
  type SharedDisclosureJudge, type SharedMemberKnowledgeItem,
} from './shared-member-knowledge.types';

/** The operational values (§4, §6): one hour each by default, bounded by the database to [60 s, 24 h]. */
export const DEFAULT_SHARED_KNOWLEDGE_COOLDOWN_SECONDS = 3_600;
export const DEFAULT_SHARED_KNOWLEDGE_REQUEST_WINDOW_SECONDS = 3_600;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const COLLECTOR_KEYS = ['owner_user_id', 'memory_id', 'content', 'content_digest', 'reasoning_grant_id', 'disclosure_grant_id',
  'membership_episode_id', 'ceiling_user_ids', 'owner_name'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

function seconds(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value !== undefined && value.trim() !== '' && Number.isSafeInteger(parsed) && parsed >= 60 && parsed <= 86_400 ? parsed : fallback;
}

/** The index terms of the message being answered: the 0171 terms, at most the 0171 query bound. */
export const sharedKnowledgeTerms = (text: string): string[] => memoryRetrievalTerms(text).slice(0, MAX_RETRIEVAL_QUERY_TERMS);

/** The 0178 rows, exactly `{ user_id, name }`, each member once, a Name non-blank or null; else none. */
export function decodeSharedAudienceNames(rows: unknown): SharedClaimAudienceMember[] | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const members: SharedClaimAudienceMember[] = [];
  for (const row of rows as ReadonlyArray<unknown>) {
    if (!isRecord(row) || Object.keys(row).length !== 2 || !('user_id' in row) || !('name' in row) || !isUuid(row.user_id)) return null;
    if (row.name !== null && (typeof row.name !== 'string' || row.name.trim().length === 0)) return null;
    if (members.some((member) => member.userId === row.user_id)) return null;
    members.push(Object.freeze({ userId: row.user_id as string, name: row.name as string | null }));
  }
  return members;
}

/** The 0176 collector's rows, exactly their shape, one per owner, each item's words matching its digest; else none. */
export function decodeSharedMemberKnowledge(rows: unknown): SharedMemberKnowledgeItem[] | null {
  if (!Array.isArray(rows)) return null;
  const items: SharedMemberKnowledgeItem[] = [];
  for (const row of rows as ReadonlyArray<unknown>) {
    if (!isRecord(row) || Object.keys(row).length !== COLLECTOR_KEYS.length || !COLLECTOR_KEYS.every((key) => key in row)) return null;
    if (![row.owner_user_id, row.memory_id, row.reasoning_grant_id, row.disclosure_grant_id, row.membership_episode_id].every(isUuid)) return null;
    if (typeof row.content !== 'string' || row.content.trim().length === 0 || row.content_digest !== digestReasoningContent(row.content)) return null;
    if (!Array.isArray(row.ceiling_user_ids) || row.ceiling_user_ids.length === 0 || !row.ceiling_user_ids.every(isUuid)) return null;
    if (row.owner_name !== null && typeof row.owner_name !== 'string') return null;
    if (items.some((item) => item.ownerUserId === row.owner_user_id)) return null;
    items.push(Object.freeze({
      ownerUserId: row.owner_user_id as string,
      ownerName: row.owner_name as string | null,
      memoryId: row.memory_id as string,
      content: row.content,
      contentDigest: row.content_digest,
      reasoningGrantId: row.reasoning_grant_id as string,
      disclosureGrantId: row.disclosure_grant_id as string,
      membershipEpisodeId: row.membership_episode_id as string,
      ceilingUserIds: Object.freeze([...(row.ceiling_user_ids as string[])]),
    }));
  }
  return items;
}

@Injectable()
export class SharedMemberKnowledgeService {
  private readonly coolDownSeconds = seconds(process.env.SHARED_KNOWLEDGE_COOLDOWN_SECONDS, DEFAULT_SHARED_KNOWLEDGE_COOLDOWN_SECONDS);
  private readonly requestWindowSeconds = seconds(process.env.SHARED_KNOWLEDGE_REQUEST_WINDOW_SECONDS, DEFAULT_SHARED_KNOWLEDGE_REQUEST_WINDOW_SECONDS);

  constructor(
    private readonly server: SupabaseServiceRoleApiService,
    private readonly worldState: SharedPreModelWorldStateResolverService,
    private readonly audience: SharedHumanAudienceResolverService,
    @Optional() @Inject(SHARED_DISCLOSURE_JUDGE) private readonly configuredJudge: SharedDisclosureJudge | null = null,
  ) {}

  /** The judge, or null where none may run (then nothing is collected). */
  get judge(): SharedDisclosureJudge | null {
    return this.configuredJudge ?? null;
  }

  /** The consented items for this reply, or none. */
  async collect(worldId: SharedWorldId, humanMaterialId: string, messageText: string): Promise<SharedMemberKnowledgeItem[]> {
    if (this.judge === null) return [];
    const terms = sharedKnowledgeTerms(messageText);
    if (terms.length === 0) return [];
    try {
      return decodeSharedMemberKnowledge(await this.server.rpc<unknown>(SHARED_KNOWLEDGE_FOR_REPLY_RPC, {
        p_world_id: worldId, p_source_material_id: humanMaterialId, p_terms: terms,
      })) ?? [];
    } catch {
      return [];
    }
  }

  lane(worldId: SharedWorldId, items: ReadonlyArray<SharedMemberKnowledgeItem>): SharedMemberKnowledgeLane {
    return new SharedMemberKnowledgeLane(this.server, this.worldState, this.audience, worldId, items);
  }

  /** R4-2 step 1: the exact current audience's Names (0178), or null when the read fails or is not exactly its shape. */
  async audienceNames(worldId: SharedWorldId): Promise<SharedClaimAudienceMember[] | null> {
    try {
      return decodeSharedAudienceNames(await this.server.rpc<unknown>(SHARED_AUDIENCE_NAMES_RPC, { p_world_id: worldId }));
    } catch {
      return null;
    }
  }

  /** §4 under R4-3: the items a checked reply proved unsafe rest for the cooldown. Best effort. */
  async coolDown(worldId: SharedWorldId, items: ReadonlyArray<SharedMemberKnowledgeItem>): Promise<void> {
    if (items.length === 0) return;
    await this.server.rpc<unknown>(SHARED_KNOWLEDGE_COOL_DOWN_RPC, {
      p_world_id: worldId, p_owner_user_ids: items.map((item) => item.ownerUserId), p_memory_ids: items.map((item) => item.memoryId),
      p_seconds: this.coolDownSeconds,
    }).catch(() => undefined);
  }

  /** §5, after a committed reply: the local relevance read. Returns nothing a caller could act on. Best effort. */
  async propose(worldId: SharedWorldId, humanMaterialId: string, messageText: string): Promise<void> {
    const terms = sharedKnowledgeTerms(messageText);
    if (terms.length === 0) return;
    await this.server.rpc<unknown>(SHARED_KNOWLEDGE_PROPOSE_RPC, {
      p_world_id: worldId, p_source_material_id: humanMaterialId, p_terms: terms, p_window_seconds: this.requestWindowSeconds,
    }).catch(() => undefined);
  }
}
