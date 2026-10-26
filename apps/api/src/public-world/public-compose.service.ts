import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
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
export type TopicReadiness = 'READY' | 'TITLE_TOO_SHORT' | 'TEXT_REQUIRED' | 'SECTION_REQUIRED';
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
    | 'TITLE_TOO_SHORT' | 'TEXT_REQUIRED' | 'SECTION_REQUIRED' | 'NOT_PREPARED';
  readonly experienceId: string | null;
}
export interface TopicDiscardView { readonly outcome: 'DISCARDED' | 'ALREADY_DISCARDED' | 'NOT_DISCARDABLE' | 'UNAVAILABLE' }
export interface TopicSectionView { readonly outcome: 'CHANGED' | 'UNCHANGED' | 'UNAVAILABLE' | 'INVALID'; readonly sectionRevision: number | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SAVE_OUTCOMES: readonly string[] = ['CREATED', 'SAVED', 'STALE', 'NOT_FOUND', 'PREPARED', 'LIMIT_REACHED', 'INVALID', 'ACCOUNT_DELETION_PENDING'];
const DELETE_OUTCOMES: readonly string[] = ['DELETED', 'NOT_FOUND', 'NOT_DISCARDABLE', 'UNAVAILABLE', 'ACCOUNT_DELETION_PENDING'];
const PREPARE_OUTCOMES: readonly string[] = ['PREPARED', 'ALREADY_PREPARED', 'PUBLICATION_NOT_OPEN', 'ACCOUNT_DELETION_PENDING', 'NOT_FOUND', 'STALE',
  'TITLE_TOO_SHORT', 'TEXT_REQUIRED', 'SECTION_REQUIRED', 'NOT_PREPARED'];
const DISCARD_OUTCOMES: readonly string[] = ['DISCARDED', 'ALREADY_DISCARDED', 'NOT_DISCARDABLE', 'UNAVAILABLE'];
const SECTION_OUTCOMES: readonly string[] = ['CHANGED', 'UNCHANGED', 'UNAVAILABLE', 'INVALID'];
const READINESS: readonly string[] = ['READY', 'TITLE_TOO_SHORT', 'TEXT_REQUIRED', 'SECTION_REQUIRED'];
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
}
