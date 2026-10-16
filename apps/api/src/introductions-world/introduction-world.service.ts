import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError, readDataApiUpstreamIdentity } from '../conversation/supabase-data-api.service';
import {
  IntroductionWorldRepository, type IntroductionMessageCursor, type IntroductionMessageRow, type IntroductionWorldRow,
} from './introduction-world.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** An instant exactly as the database returns it (ISO 8601 with an offset), never a free-form date. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;
/** The same bound the Stage 4 send applies to one message; migration 0160 re-checks it. */
export const INTRODUCTION_MESSAGE_MAX_LENGTH = 20000;
/** One page the Product reads; one row beyond it says whether older messages exist. */
export const INTRODUCTION_MESSAGE_PAGE = 50;

export interface IntroductionWorld {
  readonly worldId: string;
  /** The proposal both humans already know: the client joins MATCH_CONCLUDED to its World through it. */
  readonly proposalId: string;
  readonly state: 'ACTIVE' | 'ENDED';
  /** The first name the Match's own handoff presented to THIS reader (never the account Name); null when not proven. */
  readonly otherFirstName: string | null;
}
export interface IntroductionMessage {
  readonly materialId: string;
  /** SELF - the reader's own words; HUMAN - the other person's. Server truth, never a client inference. */
  readonly producer: 'SELF' | 'HUMAN';
  readonly text: string;
  readonly establishedAt: string;
  /** Whether THIS reader may delete it (the existing owner deletion, R-5): only their own words. */
  readonly canDelete: boolean;
}
export type IntroductionMessagesView =
  /** Oldest first: one bounded page; `hasOlder` says whether a page strictly older than its oldest message exists. */
  | { readonly outcome: 'ACTIVE'; readonly messages: readonly IntroductionMessage[]; readonly hasOlder: boolean }
  /** Shown only to one of the World's two humans, and only on this server answer (IW-35): the Introduction has ended. */
  | { readonly outcome: 'ENDED' }
  /** Anything else: not theirs, no such World, or no longer an Introduction - one answer. */
  | { readonly outcome: 'UNAVAILABLE' };
/**
 * CP4 (migration 0161): the closed history after END - what THIS reader's own frozen entitlement holds, after every owner
 * deletion. Oldest first, one bounded page; `canDelete` marks the reader's own words, which they may still delete (R-5).
 */
export type IntroductionHistoryView =
  | { readonly outcome: 'ENDED'; readonly messages: readonly IntroductionMessage[]; readonly hasOlder: boolean }
  /** Anything else: no entitlement, no such World, not an ended Introduction - one answer. */
  | { readonly outcome: 'UNAVAILABLE' };
export type IntroductionSendView =
  | { readonly outcome: 'COMMITTED'; readonly materialId: string; readonly establishedAt: string }
  | { readonly outcome: 'ENDED' | 'UNAVAILABLE' | 'COMMAND_CONFLICT' };

const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' }); };
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
/** A real calendar day: V8 parses 2026-02-30 as March 2, which the database would refuse (22008) as unavailable, not invalid. */
const isCalendarDay = (value: string): boolean => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const isInstant = (value: unknown): value is string =>
  typeof value === 'string' && INSTANT.test(value) && Number.isFinite(Date.parse(value)) && isCalendarDay(value);
const keysAre = (row: object, keys: readonly string[]): boolean => {
  const actual = Object.keys(row);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};
const WORLD_KEYS = ['world_id', 'matching_proposal_id', 'introduction_state', 'other_first_name'];
const MESSAGE_KEYS = ['introduction_state', 'material_id', 'established_at', 'is_self', 'text_body'];
const SEND_KEYS = ['outcome', 'material_id', 'established_at'];

/** A row is used only if every field is exactly what migration 0160 answers; anything else fails closed. */
function worldOf(row: IntroductionWorldRow): IntroductionWorld {
  if (!row || typeof row !== 'object' || !keysAre(row, WORLD_KEYS) || !isUuid(row.world_id) || !isUuid(row.matching_proposal_id)
      || (row.introduction_state !== 'ACTIVE' && row.introduction_state !== 'ENDED')
      || (row.other_first_name !== null && typeof row.other_first_name !== 'string')) return unavailable();
  return Object.freeze({
    worldId: row.world_id.toLowerCase(), proposalId: row.matching_proposal_id.toLowerCase(),
    state: row.introduction_state, otherFirstName: row.other_first_name as string | null,
  });
}
const isEmptyRow = (row: IntroductionMessageRow): boolean =>
  row.material_id === null && row.established_at === null && row.is_self === null && row.text_body === null;
function messageOf(row: IntroductionMessageRow): IntroductionMessage {
  if (!isUuid(row.material_id) || !isInstant(row.established_at) || typeof row.is_self !== 'boolean' || typeof row.text_body !== 'string') return unavailable();
  return Object.freeze({
    materialId: row.material_id.toLowerCase(), producer: row.is_self ? 'SELF' : 'HUMAN',
    text: row.text_body, establishedAt: row.established_at, canDelete: row.is_self,
  });
}
/** The older-page cursor: exactly a message identity and an instant; anything else is the client's own error. */
function cursorOf(materialId: string, establishedAt: string): IntroductionMessageCursor {
  if (!isUuid(materialId) || !isInstant(establishedAt)) invalid();
  return { materialId: materialId.toLowerCase(), establishedAt };
}

/**
 * S6-05 (CP3, CP4) - the Introduction World's human conversation (D2-D5, migration 0160): find one's own Introduction
 * Worlds, read a page of the two humans' words, and send one; after END, read the closed history (migration 0161). Identity is the verified token only. This module calls NO QANDEEL
 * reply, Model Router, weaving, Living Analysis, Activity or notification, and reads no Personal Context or Matching
 * Context Grant: an Introduction World is human words only until Stage 8A (R-1). No retry here: a repeated send is the
 * same command, answered from its committed row. Nothing is logged.
 */
@Injectable()
export class IntroductionWorldService {
  constructor(private readonly repository: IntroductionWorldRepository) {}

  async worlds(token: string): Promise<{ readonly worlds: readonly IntroductionWorld[] }> {
    const rows = await this.guard(() => this.repository.worlds(token));
    if (!Array.isArray(rows)) return unavailable();
    return { worlds: rows.map(worldOf) };
  }

  /** The newest page of the World's messages. */
  messages(token: string, worldId: string): Promise<IntroductionMessagesView> {
    return this.page(token, worldId, null);
  }

  /** The one page strictly older than the oldest message the reader holds. */
  olderMessages(token: string, worldId: string, materialId: string, establishedAt: string): Promise<IntroductionMessagesView> {
    let before: IntroductionMessageCursor;
    try {
      before = cursorOf(materialId, establishedAt);
    } catch (error) {
      return Promise.reject(error);
    }
    return this.page(token, worldId, before);
  }

  private async page(token: string, worldId: string, before: IntroductionMessageCursor | null): Promise<IntroductionMessagesView> {
    if (!UUID.test(worldId)) return { outcome: 'UNAVAILABLE' };
    const rows = await this.guard(() => this.repository.messages(token, worldId.toLowerCase(), before, INTRODUCTION_MESSAGE_PAGE + 1));
    if (!Array.isArray(rows) || rows.length > INTRODUCTION_MESSAGE_PAGE + 1) return unavailable();
    // No row: not one of the two humans, no such World, or no longer an Introduction - decided by the database, one answer.
    if (rows.length === 0) return { outcome: 'UNAVAILABLE' };
    const state = rows[0]?.introduction_state;
    if (rows.some((row) => !row || typeof row !== 'object' || !keysAre(row, MESSAGE_KEYS) || row.introduction_state !== state)) return unavailable();
    if (state === 'ENDED') return rows.length === 1 && isEmptyRow(rows[0]) ? { outcome: 'ENDED' } : unavailable();
    if (state !== 'ACTIVE') return unavailable();
    if (rows.length === 1 && isEmptyRow(rows[0])) return { outcome: 'ACTIVE', messages: [], hasOlder: false };
    const messages = rows.slice(0, INTRODUCTION_MESSAGE_PAGE).map(messageOf);
    // Canonical order for reading: oldest first.
    return { outcome: 'ACTIVE', messages: messages.reverse(), hasOlder: rows.length > INTRODUCTION_MESSAGE_PAGE };
  }

  /** CP4: the newest page of the closed history the reader is entitled to keep. */
  history(token: string, worldId: string): Promise<IntroductionHistoryView> {
    return this.closedPage(token, worldId, null);
  }

  /** CP4: the one page of the closed history strictly older than the oldest message the reader holds. */
  olderHistory(token: string, worldId: string, materialId: string, establishedAt: string): Promise<IntroductionHistoryView> {
    let before: IntroductionMessageCursor;
    try {
      before = cursorOf(materialId, establishedAt);
    } catch (error) {
      return Promise.reject(error);
    }
    return this.closedPage(token, worldId, before);
  }

  private async closedPage(token: string, worldId: string, before: IntroductionMessageCursor | null): Promise<IntroductionHistoryView> {
    if (!UUID.test(worldId)) return { outcome: 'UNAVAILABLE' };
    const rows = await this.guard(() => this.repository.history(token, worldId.toLowerCase(), before, INTRODUCTION_MESSAGE_PAGE + 1));
    if (!Array.isArray(rows) || rows.length > INTRODUCTION_MESSAGE_PAGE + 1) return unavailable();
    // No row: no entitlement of this reader, no such World, or not an ended Introduction - decided by the database, one answer.
    if (rows.length === 0) return { outcome: 'UNAVAILABLE' };
    if (rows.some((row) => !row || typeof row !== 'object' || !keysAre(row, MESSAGE_KEYS) || row.introduction_state !== 'ENDED')) return unavailable();
    if (rows.length === 1 && isEmptyRow(rows[0])) return { outcome: 'ENDED', messages: [], hasOlder: false };
    const messages = rows.slice(0, INTRODUCTION_MESSAGE_PAGE).map(messageOf);
    // Canonical order for reading: oldest first.
    return { outcome: 'ENDED', messages: messages.reverse(), hasOlder: rows.length > INTRODUCTION_MESSAGE_PAGE };
  }

  async send(token: string, worldId: string, body: unknown): Promise<IntroductionSendView> {
    const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    if (Object.keys(value).some((key) => key !== 'commandId' && key !== 'content') || !isUuid(value.commandId)
        || typeof value.content !== 'string' || value.content.trim().length === 0 || value.content.length > INTRODUCTION_MESSAGE_MAX_LENGTH) invalid();
    if (!UUID.test(worldId)) return { outcome: 'UNAVAILABLE' };
    const rows = await this.guard(() => this.repository.send(token, (value.commandId as string).toLowerCase(), worldId.toLowerCase(), value.content as string));
    const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : undefined;
    if (!row || typeof row !== 'object' || !keysAre(row, SEND_KEYS)) return unavailable();
    if (row.outcome === 'COMMITTED') {
      return isUuid(row.material_id) && isInstant(row.established_at)
        ? { outcome: 'COMMITTED', materialId: row.material_id.toLowerCase(), establishedAt: row.established_at } : unavailable();
    }
    if ((row.outcome === 'ENDED' || row.outcome === 'UNAVAILABLE' || row.outcome === 'COMMAND_CONFLICT') && row.material_id === null && row.established_at === null) {
      return { outcome: row.outcome };
    }
    return unavailable();
  }

  private async guard<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      // Only a request the database refuses as malformed (22023) is the client's own contradiction. Every other refusal
      // is unavailable, with nothing of the database's answer passed on.
      if (error instanceof DataApiError && error.status === 400 && readDataApiUpstreamIdentity(error).databaseCode === '22023') return invalid();
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }
}
