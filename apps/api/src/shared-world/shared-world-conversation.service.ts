import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { SharedConversationMaterial } from '../connected-worlds/material-commit/shared-qandeel-reply.types';
import { SharedQandeelReplyService } from '../connected-worlds/material-commit/shared-qandeel-reply.service';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { SHARED_MATERIAL_PAGE, SharedWorldConversationRepository, type SharedMaterialCursor, type SharedMaterialRow } from './shared-world-conversation.repository';
import { SharedWorldRepository } from './shared-world.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** An instant exactly as the material read returns it (ISO 8601 with an offset), never a free-form date. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;
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
  | {
    readonly outcome: 'ALLOW';
    readonly conversation: boolean;
    /** Oldest first: one bounded page. */
    readonly materials: readonly SharedMaterialView[];
    /** Whether visible material older than this page exists; the next page is read with the oldest one as the cursor. */
    readonly hasOlder: boolean;
  }
  | { readonly outcome: 'UNAVAILABLE' };
export type SharedSendView =
  /**
   * `qandeel`: COMMITTED — the one reply is committed; PENDING — another request is generating it right now (a retry
   * of a lost answer), so it appears on the next read; UNAVAILABLE — no reply was committed for this message.
   */
  | { readonly outcome: 'COMMITTED'; readonly materialId: string; readonly qandeel: 'COMMITTED' | 'PENDING' | 'UNAVAILABLE' }
  | { readonly outcome: 'UNAVAILABLE' };
export type SharedDeleteView = { readonly outcome: 'DELETED' | 'UNAVAILABLE' };

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Shared World is unavailable.'); };
/** The older-page cursor: exactly a material identity and an instant; anything else is the client's own error. */
function cursorOf(materialId: string, establishedAt: string): SharedMaterialCursor {
  if (!UUID.test(materialId) || !INSTANT.test(establishedAt) || !Number.isFinite(Date.parse(establishedAt))) invalid();
  return { materialId, establishedAt };
}

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
    return this.page(token, worldId, null);
  }

  /** The one page strictly older than the oldest material the reader holds, after the entry verdict again. */
  olderMaterials(token: string, worldId: string, materialId: string, establishedAt: string): Promise<SharedMaterialsView> {
    let before: SharedMaterialCursor;
    try {
      before = cursorOf(materialId, establishedAt);
    } catch (error) {
      return Promise.reject(error);
    }
    return this.page(token, worldId, before);
  }

  /** Never more than one page per request: one row beyond it says whether older material exists. */
  private page(token: string, worldId: string, before: SharedMaterialCursor | null): Promise<SharedMaterialsView> {
    if (!UUID.test(worldId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      const [verdict] = await this.shared.resolveEntry(token, worldId);
      if (verdict?.outcome !== 'ALLOW' || verdict.world_id !== worldId) return { outcome: 'UNAVAILABLE' };
      // One row beyond the page says whether older material exists, without counting anything.
      const [rows, [capability]] = await Promise.all([this.conversation.material(token, worldId, before, SHARED_MATERIAL_PAGE + 1), this.conversation.capability(token)]);
      const materials = rows.slice(0, SHARED_MATERIAL_PAGE).map(viewOf);
      if (materials.some((m) => m === null) || capability === undefined) return unavailable();
      // Canonical order for reading: oldest first.
      return {
        outcome: 'ALLOW', conversation: capability.conversation_available === true,
        materials: (materials as SharedMaterialView[]).reverse(), hasOlder: rows.length > SHARED_MATERIAL_PAGE,
      };
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

  private async reply(userId: string, token: string, worldId: string, commandId: string, materialId: string): Promise<'COMMITTED' | 'PENDING' | 'UNAVAILABLE'> {
    try {
      const rows = await this.conversation.material(token, worldId);
      const requesterView: SharedConversationMaterial[] = [];
      for (const row of rows) {
        if (typeof row.text_body !== 'string' || typeof row.material_id !== 'string' || typeof row.established_at !== 'string') return 'UNAVAILABLE';
        requesterView.push({
          materialId: row.material_id, producer: row.producer_kind === 'QANDEEL' ? 'QANDEEL' : 'HUMAN',
          authorName: row.producer_kind === 'QANDEEL' ? null : row.author_name ?? null, text: row.text_body, establishedAt: row.established_at,
        });
      }
      const outcome = await this.replies.reply({ worldId, humanCommandId: commandId, humanMaterialId: materialId, requesterUserId: userId, requesterView });
      if (outcome.state === 'COMMITTED') return 'COMMITTED';
      return outcome.reason === 'WORK_IN_PROGRESS' ? 'PENDING' : 'UNAVAILABLE';
    } catch {
      return 'UNAVAILABLE';
    }
  }
}
