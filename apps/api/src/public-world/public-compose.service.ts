import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { understandingItemRef, understandingRevision } from '../understanding/understanding-projection';
import { PublicComposeRepository } from './public-compose.repository';

/** The fixed section keys migration 0179 seeds: twelve sections and «حكايات مفتوحة» (`open`). */
export const TOPIC_SECTIONS = [
  'love', 'marriage', 'family', 'parenting', 'people', 'work_money', 'study_future', 'inner_self', 'health_body', 'loss_crisis',
  'faith_meaning', 'life_changes', 'open',
] as const;
export type TopicSection = typeof TOPIC_SECTIONS[number];
/** The database bounds (0179): a title of 8–100 characters, a text of up to 5,000. */
export const TOPIC_TITLE_MIN = 8;
export const TOPIC_TITLE_MAX = 100;
export const TOPIC_TEXT_MAX = 5000;

export type TopicDraftState = 'EDITING' | 'PREPARED';
/**
 * S8A-05 CP2 (0180): a draft whose material is the author's own conversation or a «فهم قنديل» summary has its source's
 * own refusals (CA-S8A05-A3 9, closed), and the one acknowledgement QANDEEL material needs before it is published.
 */
export const TOPIC_SOURCE_REFUSALS = ['SOURCE_UNAVAILABLE', 'NOT_WHOLE_MESSAGES', 'SELECTION_INVALID', 'NOTHING_SELECTED', 'TOO_LARGE',
  'UNDERSTANDING_CHANGED', 'UNDERSTANDING_UNDER_REVIEW', 'UNDERSTANDING_WITHHELD'] as const;
export type TopicSourceRefusal = typeof TOPIC_SOURCE_REFUSALS[number];
export type TopicReadiness = 'READY' | 'TITLE_TOO_SHORT' | 'TEXT_REQUIRED' | 'SECTION_REQUIRED' | 'ACKNOWLEDGEMENT_REQUIRED' | TopicSourceRefusal;
/** The page the database reads (0180 B.1): every item is reachable, page by page; none is dropped. */
export const TOPIC_ITEMS_PAGE_SIZE = 50;
export const TOPIC_ITEMS_PAGE_MAX = 1000;
/** The selection lists the database accepts (0180 E.1); the request body limit binds first for very long lists. */
export const TOPIC_SOURCE_POSITIONS_MAX = 10000;
export type TopicItemRole = 'WRITTEN' | 'YOUR_MESSAGE' | 'QANDEEL_REPLY' | 'QANDEEL_UNDERSTANDING';
export type TopicPrivacyNote = 'CONTACT_NUMBER' | 'EMAIL_ADDRESS' | 'LINK' | 'OWN_NAME' | 'SHOWN_UNDER_REAL_NAME';

export interface TopicDraftSummaryView {
  readonly draftId: string; readonly revision: number; readonly title: string; readonly section: TopicSection | null;
  readonly textLength: number; readonly state: TopicDraftState; readonly experienceId: string | null; readonly updatedAt: string;
}
export interface TopicDraftsView { readonly drafts: readonly TopicDraftSummaryView[] }
export type TopicDraftView =
  | { readonly state: 'UNAVAILABLE' }
  | {
    readonly state: TopicDraftState; readonly draftId: string; readonly revision: number; readonly title: string; readonly text: string;
    readonly section: TopicSection | null; readonly experienceId: string | null; readonly createdAt: string; readonly updatedAt: string;
  };
export interface TopicSaveView {
  readonly outcome: 'CREATED' | 'SAVED' | 'STALE' | 'NOT_FOUND' | 'PREPARED' | 'LIMIT_REACHED' | 'INVALID' | 'ACCOUNT_DELETION_PENDING';
  readonly revision: number | null;
}
export interface TopicDeleteView { readonly outcome: 'DELETED' | 'NOT_FOUND' | 'NOT_DISCARDABLE' | 'UNAVAILABLE' | 'ACCOUNT_DELETION_PENDING' }
export type TopicPreviewView =
  | { readonly state: 'UNAVAILABLE' }
  | {
    readonly state: 'CURRENT'; readonly revision: number; readonly readiness: TopicReadiness; readonly title: string; readonly text: string;
    readonly section: TopicSection | null; readonly publisher: { readonly mode: 'PSEUDONYM' | 'REAL_NAME'; readonly label: string | null };
    readonly privacyNotes: readonly TopicPrivacyNote[];
  };
export interface TopicPrepareView {
  readonly outcome: 'PREPARED' | 'ALREADY_PREPARED' | 'PUBLICATION_NOT_OPEN' | 'ACCOUNT_DELETION_PENDING' | 'NOT_FOUND' | 'STALE'
    | 'TITLE_TOO_SHORT' | 'TEXT_REQUIRED' | 'SECTION_REQUIRED' | 'NOT_PREPARED' | 'ACKNOWLEDGEMENT_REQUIRED' | TopicSourceRefusal;
  readonly experienceId: string | null;
}
/** S8A-05 CP2 — setting, clearing and acknowledging a draft's source. */
export interface TopicSourceSaveView {
  readonly outcome: TopicSaveView['outcome'] | TopicSourceRefusal;
  readonly revision: number | null;
}
export interface TopicSourceClearView {
  readonly outcome: 'SAVED' | 'STALE' | 'NOT_FOUND' | 'PREPARED' | 'ACCOUNT_DELETION_PENDING'; readonly revision: number | null;
}
export interface TopicAcknowledgeView {
  readonly outcome: 'ACKNOWLEDGED' | 'STALE' | 'NOT_FOUND' | 'PREPARED' | 'NO_SOURCE' | 'ACCOUNT_DELETION_PENDING'; readonly revision: number | null;
}
/** The draft's source as the author chose it: positions in their own conversation, or one «فهم قنديل» item by its opaque ref. */
export type TopicSource =
  | { readonly kind: 'NONE' }
  | {
    readonly kind: 'CONVERSATION'; readonly sessionId: string; readonly firstPosition: number; readonly lastPosition: number;
    readonly includeQandeelReplies: boolean; readonly excludedMessagePositions: readonly number[]; readonly emphasizedMessagePositions: readonly number[];
  }
  | { readonly kind: 'UNDERSTANDING'; readonly ref: string; readonly revision: string };
export type TopicSourceView =
  | { readonly state: 'UNAVAILABLE' }
  | { readonly state: 'CURRENT'; readonly revision: number; readonly source: TopicSource; readonly acknowledged: boolean };
export interface TopicItemView {
  readonly position: number; readonly role: TopicItemRole; readonly sessionPosition: number | null; readonly message: number | null;
  readonly emphasized: boolean; readonly gapBefore: boolean; readonly text: string;
}
export type TopicItemsView =
  | { readonly state: 'UNAVAILABLE' }
  | {
    readonly state: 'EDITING' | 'PREPARED'; readonly revision: number; readonly outcome: 'RESOLVED' | 'PREPARED' | 'NO_SOURCE' | TopicSourceRefusal;
    readonly itemCount: number; readonly page: number; readonly pageCount: number; readonly items: readonly TopicItemView[];
  };
export interface TopicDiscardView { readonly outcome: 'DISCARDED' | 'ALREADY_DISCARDED' | 'NOT_DISCARDABLE' | 'UNAVAILABLE' }
/**
 * S8A-05 CP2 — the answer to choosing an item as a Public topic's source: the draft's outcome and revision, never the
 * item's text. CREATED / SAVED, or the draft's own refusal, or the item's (it changed, is under review, or its summary
 * is withheld). It is a draft's answer, so it lives with the drafts; the Understanding Product types carry no number.
 */
export const UNDERSTANDING_PUBLIC_TOPIC_OUTCOMES = ['CREATED', 'SAVED', 'STALE', 'NOT_FOUND', 'PREPARED', 'LIMIT_REACHED', 'INVALID',
  'ACCOUNT_DELETION_PENDING', 'SOURCE_UNAVAILABLE', 'NOTHING_SELECTED', 'TOO_LARGE', 'UNDERSTANDING_CHANGED', 'UNDERSTANDING_UNDER_REVIEW',
  'UNDERSTANDING_WITHHELD'] as const;
export interface UnderstandingPublicTopicSourceView {
  readonly outcome: typeof UNDERSTANDING_PUBLIC_TOPIC_OUTCOMES[number];
  readonly draftRevision: number | null;
}

export interface TopicSectionView { readonly outcome: 'CHANGED' | 'UNCHANGED' | 'UNAVAILABLE' | 'INVALID'; readonly sectionRevision: number | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SAVE_OUTCOMES: readonly string[] = ['CREATED', 'SAVED', 'STALE', 'NOT_FOUND', 'PREPARED', 'LIMIT_REACHED', 'INVALID', 'ACCOUNT_DELETION_PENDING'];
const DELETE_OUTCOMES: readonly string[] = ['DELETED', 'NOT_FOUND', 'NOT_DISCARDABLE', 'UNAVAILABLE', 'ACCOUNT_DELETION_PENDING'];
const PREPARE_OUTCOMES: readonly string[] = ['PREPARED', 'ALREADY_PREPARED', 'PUBLICATION_NOT_OPEN', 'ACCOUNT_DELETION_PENDING', 'NOT_FOUND', 'STALE',
  'TITLE_TOO_SHORT', 'TEXT_REQUIRED', 'SECTION_REQUIRED', 'NOT_PREPARED', 'ACKNOWLEDGEMENT_REQUIRED', ...TOPIC_SOURCE_REFUSALS];
const DISCARD_OUTCOMES: readonly string[] = ['DISCARDED', 'ALREADY_DISCARDED', 'NOT_DISCARDABLE', 'UNAVAILABLE'];
const SECTION_OUTCOMES: readonly string[] = ['CHANGED', 'UNCHANGED', 'UNAVAILABLE', 'INVALID'];
const READINESS: readonly string[] = ['READY', 'TITLE_TOO_SHORT', 'TEXT_REQUIRED', 'SECTION_REQUIRED', 'ACKNOWLEDGEMENT_REQUIRED', ...TOPIC_SOURCE_REFUSALS];
const SOURCE_OUTCOMES: readonly string[] = [...SAVE_OUTCOMES, ...TOPIC_SOURCE_REFUSALS];
const CLEAR_OUTCOMES: readonly string[] = ['SAVED', 'STALE', 'NOT_FOUND', 'PREPARED', 'ACCOUNT_DELETION_PENDING'];
const ACKNOWLEDGE_OUTCOMES: readonly string[] = ['ACKNOWLEDGED', 'STALE', 'NOT_FOUND', 'PREPARED', 'NO_SOURCE', 'ACCOUNT_DELETION_PENDING'];
const ITEMS_OUTCOMES: readonly string[] = ['RESOLVED', 'PREPARED', 'NO_SOURCE', ...TOPIC_SOURCE_REFUSALS];
const ROLES: readonly string[] = ['WRITTEN', 'YOUR_MESSAGE', 'QANDEEL_REPLY', 'QANDEEL_UNDERSTANDING'];
const ITEM_KEYS = ['emphasized', 'gapBefore', 'message', 'position', 'role', 'sessionPosition', 'text'];
/** A reader's item (0180 E.7) is the same without its Session Position, which stays the author's. */
const PUBLIC_ITEM_KEYS = ITEM_KEYS.filter((key) => key !== 'sessionPosition');
const NOTES: readonly string[] = ['CONTACT_NUMBER', 'EMAIL_ADDRESS', 'LINK', 'OWN_NAME', 'SHOWN_UNDER_REAL_NAME'];
const STATES: readonly string[] = ['EDITING', 'PREPARED'];

const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Public topics are unavailable.'); };
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isSection = (value: unknown): value is TopicSection => typeof value === 'string' && (TOPIC_SECTIONS as readonly string[]).includes(value);
const sectionOf = (value: unknown): TopicSection | null => (value === null ? null : isSection(value) ? value : unavailable());
/** PostgREST answers a bigint as a JSON number. */
const revisionOf = (value: unknown): number | null => {
  const n = typeof value === 'string' && /^[0-9]+$/u.test(value) ? Number(value) : value;
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 1 ? n : null;
};

/** The body names exactly the allowed keys; a command carries the caller's own fresh command id. */
function bodyOf(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  if (!value || Object.keys(value).some((key) => !allowed.includes(key))) invalid();
  return value as Record<string, unknown>;
}
function commandOf(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  const value = bodyOf(body, allowed);
  if (!isUuid(value.commandId)) invalid();
  return value;
}
const isPosition = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isRevision = (value: unknown, min: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
const positionsOf = (value: unknown): number[] => {
  if (!Array.isArray(value) || value.length > TOPIC_SOURCE_POSITIONS_MAX || !value.every(isPosition)) return invalid();
  return [...value as number[]];
};
/** `?page=N`, 1 by default; nothing else is asked. */
export function topicPageOf(query: unknown): number {
  const value = (query && typeof query === 'object' && !Array.isArray(query) ? query : {}) as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== 'page')) return invalid();
  if (value.page === undefined) return 1;
  const page = typeof value.page === 'string' && /^[1-9][0-9]{0,3}$/u.test(value.page) ? Number(value.page) : Number.NaN;
  return Number.isSafeInteger(page) && page <= TOPIC_ITEMS_PAGE_MAX ? page : invalid();
}
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
/**
 * One page of a topic's items, exactly the 0180 item shape, in display order and never more than a page. `roles` is the
 * closed set the read may answer; anything else, a repeated or an out-of-order position, fails closed.
 */
export function topicItemsOf<R extends string>(value: unknown, roles: readonly R[], audience: 'AUTHOR' | 'READER' = 'AUTHOR'): Array<{
  readonly position: number; readonly role: R; readonly sessionPosition: number | null; readonly message: number | null;
  readonly emphasized: boolean; readonly gapBefore: boolean; readonly text: string;
}> {
  const keys = (audience === 'AUTHOR' ? ITEM_KEYS : PUBLIC_ITEM_KEYS).join();
  if (!Array.isArray(value) || value.length > TOPIC_ITEMS_PAGE_SIZE) return unavailable();
  let previous = 0;
  return value.map((item: unknown) => {
    const row = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : null;
    if (!row || Object.keys(row).sort().join() !== keys || !isPosition(row.position) || row.position <= previous
      || typeof row.role !== 'string' || !(roles as readonly string[]).includes(row.role)
      || (audience === 'AUTHOR' && row.sessionPosition !== null && !isPosition(row.sessionPosition)) || (row.message !== null && !isPosition(row.message))
      || typeof row.emphasized !== 'boolean' || typeof row.gapBefore !== 'boolean' || typeof row.text !== 'string') {
      return unavailable();
    }
    previous = row.position;
    return { position: row.position, role: row.role as R, sessionPosition: audience === 'AUTHOR' ? row.sessionPosition as number | null : null, message: row.message as number | null,
      emphasized: row.emphasized, gapBefore: row.gapBefore, text: row.text };
  });
}

/**
 * S8A-05 CP1 — «اكتب موضوعك» / Write your topic, over migration 0179, on the existing I-05 Public Experience.
 *
 *   - a private, account-bound draft: a human title, the author's own text and one chosen section — saved, read back
 *     from any session of the same account, edited (compare-and-set on its revision) and deleted (its words are gone);
 *   - a preview of exactly what the Public World would show, with the author's current public display and the
 *     deterministic privacy notes;
 *   - preparing the draft for publication — freezes it as one PUBLIC_AUTHORED package on a Public Experience. It is
 *     CLOSED (PUBLICATION_NOT_OPEN) until the Stage 9 gates open: nothing is written, and no Public Identity is made;
 *   - discarding a never-published topic returns it to the draft and erases its unpublished Public copy;
 *   - changing a topic's section, which never moves its place.
 *
 * The draft text crosses this boundary only between its author and their own private draft. Identity is the verified
 * token only. Nothing is logged.
 */
@Injectable()
export class PublicComposeService {
  constructor(private readonly repository: PublicComposeRepository) {}

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }

  drafts(token: string): Promise<TopicDraftsView> {
    return this.guard(async () => {
      const rows = await this.repository.drafts(token);
      if (!Array.isArray(rows)) return unavailable();
      return {
        drafts: rows.map((row) => {
          const revision = revisionOf(row.draft_revision);
          if (!isUuid(row.draft_id) || revision === null || typeof row.title !== 'string' || typeof row.text_length !== 'number'
            || !STATES.includes(row.draft_state) || (row.experience_id !== null && !isUuid(row.experience_id)) || typeof row.updated_at !== 'string') {
            return unavailable();
          }
          return {
            draftId: row.draft_id, revision, title: row.title, section: sectionOf(row.section_key), textLength: row.text_length,
            state: row.draft_state as TopicDraftState, experienceId: row.experience_id, updatedAt: row.updated_at,
          };
        }),
      };
    });
  }

  draft(token: string, draftId: string): Promise<TopicDraftView> {
    if (!isUuid(draftId)) return Promise.resolve({ state: 'UNAVAILABLE' });
    return this.guard(async () => {
      const rows = await this.repository.draft(token, draftId);
      if (!Array.isArray(rows) || rows.length > 1) return unavailable();
      const [row] = rows;
      // No row: not this human's draft, or none at all. One neutral answer.
      if (!row) return { state: 'UNAVAILABLE' };
      const revision = revisionOf(row.draft_revision);
      if (row.draft_id !== draftId || revision === null || typeof row.title !== 'string' || typeof row.body !== 'string'
        || !STATES.includes(row.draft_state) || (row.experience_id !== null && !isUuid(row.experience_id))
        || typeof row.created_at !== 'string' || typeof row.updated_at !== 'string') {
        return unavailable();
      }
      return {
        state: row.draft_state as TopicDraftState, draftId, revision, title: row.title, text: row.body, section: sectionOf(row.section_key),
        experienceId: row.experience_id, createdAt: row.created_at, updatedAt: row.updated_at,
      };
    });
  }

  /** Creating is saving revision 0 under a fresh draft id the client chose; the database bounds everything again. */
  save(token: string, draftId: string, body: unknown): Promise<TopicSaveView> {
    const value = bodyOf(body, ['expectedRevision', 'title', 'text', 'section']);
    const { expectedRevision, title, text, section } = value;
    if (!isUuid(draftId) || typeof expectedRevision !== 'number' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0
      || typeof title !== 'string' || title.length > TOPIC_TITLE_MAX || typeof text !== 'string' || text.length > TOPIC_TEXT_MAX
      || (section !== null && section !== undefined && !isSection(section))) {
      invalid();
    }
    return this.guard(async () => {
      const [row] = await this.repository.save(token, draftId, expectedRevision as number, title as string, text as string,
        (section ?? null) as string | null);
      if (!row || !SAVE_OUTCOMES.includes(row.outcome)) return unavailable();
      return { outcome: row.outcome as TopicSaveView['outcome'], revision: revisionOf(row.draft_revision) };
    });
  }

  remove(token: string, draftId: string, body: unknown): Promise<TopicDeleteView> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!isUuid(draftId)) return Promise.resolve({ outcome: 'NOT_FOUND' });
    return this.guard(async () => {
      const [row] = await this.repository.remove(token, commandId as string, draftId);
      if (!row || !DELETE_OUTCOMES.includes(row.outcome)) return unavailable();
      return { outcome: row.outcome as TopicDeleteView['outcome'] };
    });
  }

  preview(token: string, draftId: string): Promise<TopicPreviewView> {
    if (!isUuid(draftId)) return Promise.resolve({ state: 'UNAVAILABLE' });
    return this.guard(async () => {
      const rows = await this.repository.preview(token, draftId);
      if (!Array.isArray(rows) || rows.length > 1) return unavailable();
      const [row] = rows;
      if (!row) return { state: 'UNAVAILABLE' };
      const revision = revisionOf(row.draft_revision);
      const mode = row.publisher_label_mode;
      if (revision === null || !READINESS.includes(row.readiness) || typeof row.title !== 'string' || typeof row.body !== 'string'
        || (mode !== 'PSEUDONYM' && mode !== 'REAL_NAME') || (row.publisher_display_label !== null && typeof row.publisher_display_label !== 'string')
        || !Array.isArray(row.privacy_notes) || !row.privacy_notes.every((note) => NOTES.includes(note))) {
        return unavailable();
      }
      return {
        state: 'CURRENT', revision, readiness: row.readiness as TopicReadiness, title: row.title, text: row.body, section: sectionOf(row.section_key),
        publisher: { mode, label: row.publisher_display_label }, privacyNotes: row.privacy_notes as TopicPrivacyNote[],
      };
    });
  }

  prepare(token: string, draftId: string, body: unknown): Promise<TopicPrepareView> {
    const value = commandOf(body, ['commandId', 'expectedRevision']);
    const revision = value.expectedRevision;
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1) invalid();
    if (!isUuid(draftId)) return Promise.resolve({ outcome: 'NOT_FOUND', experienceId: null });
    return this.guard(async () => {
      const [row] = await this.repository.prepare(token, value.commandId as string, draftId, revision as number);
      if (!row || !PREPARE_OUTCOMES.includes(row.outcome) || (row.experience_id !== null && !isUuid(row.experience_id))) return unavailable();
      return { outcome: row.outcome as TopicPrepareView['outcome'], experienceId: row.experience_id };
    });
  }

  discard(token: string, experienceId: string, body: unknown): Promise<TopicDiscardView> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!isUuid(experienceId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      const [row] = await this.repository.discard(token, commandId as string, experienceId);
      if (!row || !DISCARD_OUTCOMES.includes(row.outcome)) return unavailable();
      return { outcome: row.outcome as TopicDiscardView['outcome'] };
    });
  }

  section(token: string, experienceId: string, body: unknown): Promise<TopicSectionView> {
    const value = commandOf(body, ['commandId', 'section']);
    if (!isSection(value.section)) invalid();
    if (!isUuid(experienceId)) return Promise.resolve({ outcome: 'UNAVAILABLE', sectionRevision: null });
    return this.guard(async () => {
      const [row] = await this.repository.section(token, value.commandId as string, experienceId, value.section as string);
      if (!row || !SECTION_OUTCOMES.includes(row.outcome)) return unavailable();
      return { outcome: row.outcome as TopicSectionView['outcome'], sectionRevision: revisionOf(row.section_revision) };
    });
  }

  /**
   * S8A-05 CP2 — the draft takes its material from the author's own conversation, named by Session Positions only:
   * a contiguous range of whole messages, QANDEEL's replies in it or not, whole messages left out and messages
   * emphasized, each by its first position. No text, speaker or order is sent: the database reads them, and refuses a
   * range or a message that is not whole. Creating is revision 0 under a fresh draft id, as for a written draft.
   */
  setConversationSource(token: string, draftId: string, body: unknown): Promise<TopicSourceSaveView> {
    const value = bodyOf(body, ['expectedRevision', 'sessionId', 'firstPosition', 'lastPosition', 'includeQandeelReplies',
      'excludedMessagePositions', 'emphasizedMessagePositions']);
    if (!isUuid(draftId) || !isRevision(value.expectedRevision, 0) || !isUuid(value.sessionId) || !isPosition(value.firstPosition)
      || !isPosition(value.lastPosition) || value.lastPosition < value.firstPosition || typeof value.includeQandeelReplies !== 'boolean') {
      invalid();
    }
    const excludedSps = positionsOf(value.excludedMessagePositions ?? []);
    const emphasizedSps = positionsOf(value.emphasizedMessagePositions ?? []);
    return this.guard(async () => {
      const [row] = await this.repository.setConversationSource(token, draftId, value.expectedRevision as number, {
        sessionId: (value.sessionId as string).toLowerCase(), firstSp: value.firstPosition as number, lastSp: value.lastPosition as number,
        includeQandeel: value.includeQandeelReplies as boolean, excludedSps, emphasizedSps,
      });
      if (!row || !SOURCE_OUTCOMES.includes(row.outcome)) return unavailable();
      return { outcome: row.outcome as TopicSourceSaveView['outcome'], revision: revisionOf(row.draft_revision) };
    });
  }

  /** The draft has no source again; what the author wrote stays. */
  clearSource(token: string, draftId: string, body: unknown): Promise<TopicSourceClearView> {
    const value = bodyOf(body, ['expectedRevision']);
    if (!isRevision(value.expectedRevision, 1)) invalid();
    if (!isUuid(draftId)) return Promise.resolve({ outcome: 'NOT_FOUND', revision: null });
    return this.guard(async () => {
      const [row] = await this.repository.clearSource(token, draftId, value.expectedRevision as number);
      if (!row || !CLEAR_OUTCOMES.includes(row.outcome)) return unavailable();
      return { outcome: row.outcome as TopicSourceClearView['outcome'], revision: revisionOf(row.draft_revision) };
    });
  }

  /**
   * The author's ONE acknowledgement that QANDEEL's words may describe other people and that publishing them is their
   * decision (CA-S8A05-A3 6), for the exact revision they previewed. Any later change to the source asks again.
   */
  acknowledgeSource(token: string, draftId: string, body: unknown): Promise<TopicAcknowledgeView> {
    const value = bodyOf(body, ['revision']);
    if (!isRevision(value.revision, 1)) invalid();
    if (!isUuid(draftId)) return Promise.resolve({ outcome: 'NOT_FOUND', revision: null });
    return this.guard(async () => {
      const [row] = await this.repository.acknowledgeSource(token, draftId, value.revision as number);
      if (!row || !ACKNOWLEDGE_OUTCOMES.includes(row.outcome)) return unavailable();
      return { outcome: row.outcome as TopicAcknowledgeView['outcome'], revision: revisionOf(row.draft_revision) };
    });
  }

  /** The draft's source as its author chose it. A «فهم قنديل» item is named by its opaque ref, never its identifier. */
  source(token: string, userId: string, draftId: string): Promise<TopicSourceView> {
    if (!isUuid(draftId)) return Promise.resolve({ state: 'UNAVAILABLE' });
    return this.guard(async () => {
      const rows = await this.repository.source(token, draftId);
      if (!Array.isArray(rows) || rows.length > 1) return unavailable();
      const [row] = rows;
      if (!row) return { state: 'UNAVAILABLE' };
      const revision = revisionOf(row.draft_revision);
      if (revision === null || typeof row.acknowledged !== 'boolean') return unavailable();
      let source: TopicSource;
      if (row.source_kind === null) {
        source = { kind: 'NONE' };
      } else if (row.source_kind === 'CONVERSATION') {
        if (!isUuid(row.session_id) || !isPosition(row.first_sp) || !isPosition(row.last_sp) || typeof row.include_qandeel !== 'boolean'
          || !Array.isArray(row.excluded_sps) || !row.excluded_sps.every(isPosition)
          || !Array.isArray(row.emphasized_sps) || !row.emphasized_sps.every(isPosition)) return unavailable();
        source = { kind: 'CONVERSATION', sessionId: row.session_id, firstPosition: row.first_sp, lastPosition: row.last_sp,
          includeQandeelReplies: row.include_qandeel, excludedMessagePositions: [...row.excluded_sps], emphasizedMessagePositions: [...row.emphasized_sps] };
      } else if (row.source_kind === 'UNDERSTANDING') {
        if (!isUuid(row.hypothesis_id) || !isPosition(row.hypothesis_version)) return unavailable();
        source = { kind: 'UNDERSTANDING', ref: understandingItemRef(userId, row.hypothesis_id),
          revision: understandingRevision(userId, row.hypothesis_id, row.hypothesis_version) };
      } else {
        return unavailable();
      }
      return { state: 'CURRENT', revision, source, acknowledged: row.acknowledged };
    });
  }

  /**
   * One page of exactly the items the topic would contain (or, once prepared, the sealed ones), with their speaker,
   * emphasis and gaps — the same projection the preparation seals. A source that no longer resolves answers its
   * refusal and no item.
   */
  items(token: string, draftId: string, query: unknown): Promise<TopicItemsView> {
    const page = topicPageOf(query);
    if (!isUuid(draftId)) return Promise.resolve({ state: 'UNAVAILABLE' });
    return this.guard(async () => {
      const rows = await this.repository.items(token, draftId, page);
      if (!Array.isArray(rows) || rows.length > 1) return unavailable();
      const [row] = rows;
      if (!row) return { state: 'UNAVAILABLE' };
      const revision = revisionOf(row.draft_revision);
      if (revision === null || !STATES.includes(row.draft_state) || !ITEMS_OUTCOMES.includes(row.outcome) || row.page !== page
        || !isCount(row.page_count)) return unavailable();
      const items = topicItemsOf(row.items, ROLES as readonly TopicItemRole[]);
      // A refusal carries no item; a resolved page past the last one is empty.
      if ((row.outcome !== 'RESOLVED' && row.outcome !== 'PREPARED' && items.length > 0)) return unavailable();
      return { state: row.draft_state as 'EDITING' | 'PREPARED', revision, outcome: row.outcome as Extract<TopicItemsView, { state: 'EDITING' }>['outcome'],
        itemCount: isCount(row.item_count) ? row.item_count : 0, page, pageCount: row.page_count, items };
    });
  }
}
