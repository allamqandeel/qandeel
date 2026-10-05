import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { SharedConversationMaterial } from '../connected-worlds/material-commit/shared-qandeel-reply.types';
import { SharedQandeelReplyService } from '../connected-worlds/material-commit/shared-qandeel-reply.service';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { SharedWorldConversationRepository, type SharedMaterialRow } from './shared-world-conversation.repository';
import { SharedWorldRepository } from './shared-world.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** The same bound the Personal conversation route applies to one submission; 0139 re-checks it. */
export const SHARED_MESSAGE_MAX_LENGTH = 20000;

export interface SharedMaterialView {
  readonly materialId: string;
  /** SELF — the reader's own words; HUMAN — another person's; QANDEEL — QANDEEL's. Server truth, never a client inference. */
  readonly producer: 'SELF' | 'HUMAN' | 'QANDEEL';
  /** The other person's legitimate Name (HUMAN only); null for SELF, QANDEEL or an unset Name. */
  readonly authorName: string | null;
  readonly text: string;
  readonly establishedAt: string;
  /** Whether THIS reader may delete it: only their own words. */
  readonly canDelete: boolean;
}
export type SharedMaterialsView =
  | { readonly outcome: 'ALLOW'; readonly conversation: boolean; readonly materials: readonly SharedMaterialView[] }
  | { readonly outcome: 'UNAVAILABLE' };
export type SharedSendView =
  | { readonly outcome: 'COMMITTED'; readonly materialId: string; readonly qandeel: 'COMMITTED' | 'UNAVAILABLE' }
  | { readonly outcome: 'UNAVAILABLE' };
export type SharedDeleteView = { readonly outcome: 'DELETED' | 'UNAVAILABLE' };

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Shared World is unavailable.'); };
function commandOf(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  const value = record(body);
  if (Object.keys(value).some((key) => !allowed.includes(key)) || typeof value.commandId !== 'string' || !UUID.test(value.commandId)) invalid();
  return value;
}

/** Exactly what the reader may see of one row, or nothing when the row is not the 0139 shape. */
function viewOf(row: SharedMaterialRow): SharedMaterialView | null {
  if (typeof row.material_id !== 'string' || !UUID.test(row.material_id) || typeof row.text_body !== 'string' || typeof row.established_at !== 'string') return null;
  if (row.producer_kind === 'QANDEEL') {
    return { materialId: row.material_id, producer: 'QANDEEL', authorName: null, text: row.text_body, establishedAt: row.established_at, canDelete: false };
  }
  if (row.producer_kind !== 'HUMAN' || row.material_kind !== 'HUMAN_TEXT') return null;
  const self = row.is_self === true;
  return {
    materialId: row.material_id, producer: self ? 'SELF' : 'HUMAN', authorName: self ? null : row.author_name ?? null,
    text: row.text_body, establishedAt: row.established_at, canDelete: self && row.can_delete === true,
  };
}

/**
 * S4-02 — the Shared conversation Product boundary over migration 0139 and the Connected Worlds reply composition.
 * Identity is the verified token only. Nothing of a World is returned before the S4-01 entry verdict is ALLOW; a send
 * commits the human's words first and reports QANDEEL's reply as its own separate, truthful outcome; a delete is the
 * owner's privacy act. Nothing is logged.
 */
@Injectable()
export class SharedWorldConversationService {
  constructor(
    private readonly shared: SharedWorldRepository,
    private readonly conversation: SharedWorldConversationRepository,
    private readonly replies: SharedQandeelReplyService,
  ) {}

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      // The frozen command conflict (the same command with different words): the client's own contradiction.
      if (error instanceof DataApiError && error.status === 409) return invalid();
      return unavailable();
    }
  }

  /** The newest page of the World's visible material, after the entry verdict, with the conversation capability hint. */
  materials(token: string, worldId: string): Promise<SharedMaterialsView> {
    if (!UUID.test(worldId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      const [verdict] = await this.shared.resolveEntry(token, worldId);
      if (verdict?.outcome !== 'ALLOW' || verdict.world_id !== worldId) return { outcome: 'UNAVAILABLE' };
      const [rows, [capability]] = await Promise.all([this.conversation.newestMaterial(token, worldId), this.conversation.capability(token)]);
      const materials = rows.map(viewOf);
      if (materials.some((m) => m === null) || capability === undefined) return unavailable();
      // Canonical order for reading: oldest first.
      return { outcome: 'ALLOW', conversation: capability.conversation_available === true, materials: (materials as SharedMaterialView[]).reverse() };
    });
  }

  async send(userId: string, token: string, worldId: string, body: unknown): Promise<SharedSendView> {
    const value = commandOf(body, ['commandId', 'content']);
    if (typeof value.content !== 'string' || value.content.trim().length === 0 || value.content.length > SHARED_MESSAGE_MAX_LENGTH) invalid();
    if (!UUID.test(worldId)) return { outcome: 'UNAVAILABLE' };
    const commandId = value.commandId as string;
    return this.guard(async () => {
      const [sent] = await this.conversation.sendText(token, commandId, worldId, value.content as string);
      if (sent?.outcome === 'UNAVAILABLE') return { outcome: 'UNAVAILABLE' };
      if (sent?.outcome !== 'COMMITTED' || typeof sent.material_id !== 'string' || !UUID.test(sent.material_id)) return unavailable();
      // A retry of a command whose reply already committed: the one reply is the answer; nothing is generated again.
      if (typeof sent.qandeel_reply_material_id === 'string') return { outcome: 'COMMITTED', materialId: sent.material_id, qandeel: 'COMMITTED' };
      // The human's words are committed. QANDEEL's reply is a separate outcome and never undoes them.
      const qandeel = await this.reply(userId, token, worldId, commandId, sent.material_id);
      return { outcome: 'COMMITTED', materialId: sent.material_id, qandeel };
    });
  }

  async deleteMaterial(token: string, worldId: string, materialId: string, body: unknown): Promise<SharedDeleteView> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!UUID.test(worldId) || !UUID.test(materialId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      const [row] = await this.conversation.deleteOwn(token, commandId as string, worldId, materialId);
      if (row?.outcome === 'DELETED' || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  private async reply(userId: string, token: string, worldId: string, commandId: string, materialId: string): Promise<'COMMITTED' | 'UNAVAILABLE'> {
    try {
      const rows = await this.conversation.newestMaterial(token, worldId);
      const requesterView: SharedConversationMaterial[] = [];
      for (const row of rows) {
        if (typeof row.text_body !== 'string' || typeof row.material_id !== 'string' || typeof row.established_at !== 'string') return 'UNAVAILABLE';
        requesterView.push({
          materialId: row.material_id, producer: row.producer_kind === 'QANDEEL' ? 'QANDEEL' : 'HUMAN',
          authorName: row.producer_kind === 'QANDEEL' ? null : row.author_name ?? null, text: row.text_body, establishedAt: row.established_at,
        });
      }
      const outcome = await this.replies.reply({ worldId, humanCommandId: commandId, humanMaterialId: materialId, requesterUserId: userId, requesterView });
      return outcome.state === 'COMMITTED' ? 'COMMITTED' : 'UNAVAILABLE';
    } catch {
      return 'UNAVAILABLE';
    }
  }
}
