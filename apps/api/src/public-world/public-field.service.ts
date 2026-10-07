import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { isCanonicalCoordinateText } from './public-spatial-placer';
import type { PublicFieldContentRow, PublicFieldEntryRow, PublicFieldExperienceRow } from './public-field.repository';
import { PublicFieldRepository } from './public-field.repository';

/** One Experience in the field: its place (exact integer text), its reviewed meaning and its semantic region. */
export interface PublicFieldEntryView { readonly id: string; readonly x: string; readonly y: string; readonly meaning: string; readonly region: string }
export interface PublicFieldView { readonly experiences: ReadonlyArray<PublicFieldEntryView> }
export interface PublicFieldSearchView { readonly results: ReadonlyArray<PublicFieldEntryView> }
export type PublicFieldExperienceView =
  | { readonly state: 'UNAVAILABLE' }
  | {
    readonly state: 'SERVED';
    readonly experience: PublicFieldEntryView & {
      readonly primaryThemes: ReadonlyArray<string>; readonly secondaryThemes: ReadonlyArray<string>;
      readonly publisher: { readonly mode: 'PSEUDONYM' | 'REAL_NAME'; readonly label: string | null };
      readonly publishedAt: string; readonly discussionCount: number; readonly qandeelResponseCount: number;
    };
    readonly content: ReadonlyArray<{ readonly ordinal: number; readonly kind: 'SOURCE_CONTENT' | 'ANALYSIS'; readonly text: string }>;
    readonly nearby: ReadonlyArray<PublicFieldEntryView>;
  };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** The database's bounds: at most 400 field entries, 20 search results, 3 nearby. */
export const PUBLIC_FIELD_MAX = 400;
export const PUBLIC_SEARCH_MAX = 20;
export const PUBLIC_NEARBY_MAX = 3;
export const PUBLIC_SEARCH_QUERY_MAX = 120;

const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Public World is unavailable.'); };
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');

function entryOf(row: PublicFieldEntryRow): PublicFieldEntryView {
  if (!isUuid(row?.experience_id) || !isCanonicalCoordinateText(row.world_x) || !isCanonicalCoordinateText(row.world_y)
    || typeof row.meaning !== 'string' || row.meaning.length === 0 || typeof row.semantic_region !== 'string' || row.semantic_region.length === 0) return unavailable();
  return { id: row.experience_id, x: row.world_x, y: row.world_y, meaning: row.meaning, region: row.semantic_region };
}
function entriesOf(rows: readonly PublicFieldEntryRow[], max: number): PublicFieldEntryView[] {
  if (!Array.isArray(rows) || rows.length > max) return unavailable();
  return rows.map(entryOf);
}

/**
 * S5-03B — «العالم العام» / Public World as a World: the semantic field the viewer explores, search over the SAME field,
 * and the contextual panel of one Experience in it.
 *
 * Every answer is decided by the database for the viewer's own token: admission, canonical visibility, the exact visible
 * version, its reviewed S5-03A meaning and its current place. An Experience that is not served — hidden, stale, guessed,
 * or a viewer not admitted — is one neutral absence, never a reason. Nothing here ranks by popularity or views, invents
 * a count, draws a relation, or publishes; nothing is logged.
 */
@Injectable()
export class PublicFieldService {
  constructor(private readonly repository: PublicFieldRepository) {}

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }

  /** The field inside one world rectangle: exactly { minX, minY, maxX, maxY }, exact integer text, min ≤ max. */
  field(token: string, query: unknown): Promise<PublicFieldView> {
    const value = query && typeof query === 'object' && !Array.isArray(query) ? query as Record<string, unknown> : {};
    const keys = ['minX', 'minY', 'maxX', 'maxY'];
    if (Object.keys(value).length !== keys.length || !keys.every((key) => isCanonicalCoordinateText(value[key]))) invalid();
    const [minX, minY, maxX, maxY] = keys.map((key) => value[key] as string);
    if (BigInt(minX) > BigInt(maxX) || BigInt(minY) > BigInt(maxY)) invalid();
    return this.guard(async () => ({ experiences: entriesOf(await this.repository.field(token, minX, minY, maxX, maxY), PUBLIC_FIELD_MAX) }));
  }

  /** Search over the same field: exactly { q }, one trimmed line of 1–120 characters. */
  search(token: string, query: unknown): Promise<PublicFieldSearchView> {
    const value = query && typeof query === 'object' && !Array.isArray(query) ? query as Record<string, unknown> : {};
    const q = value.q;
    if (Object.keys(value).length !== 1 || typeof q !== 'string' || q.length < 1 || q.length > PUBLIC_SEARCH_QUERY_MAX || q !== q.trim()
      || /[\n\r\t]/u.test(q)) invalid();
    return this.guard(async () => ({ results: entriesOf(await this.repository.search(token, q as string), PUBLIC_SEARCH_MAX) }));
  }

  /** The contextual panel of one Experience the field showed: its meaning, public display, content and nearby context. */
  experience(token: string, experienceId: string): Promise<PublicFieldExperienceView> {
    if (!isUuid(experienceId)) return Promise.resolve({ state: 'UNAVAILABLE' });
    return this.guard(async () => {
      const rows = await this.repository.experience(token, experienceId);
      if (!Array.isArray(rows) || rows.length > 1) return unavailable();
      if (rows.length === 0) return { state: 'UNAVAILABLE' as const };
      const [content, nearby] = await Promise.all([this.repository.content(token, experienceId), this.repository.nearby(token, experienceId)]);
      return servedOf(rows[0], content, nearby);
    });
  }
}

function servedOf(row: PublicFieldExperienceRow, content: readonly PublicFieldContentRow[], nearby: readonly PublicFieldEntryRow[]): PublicFieldExperienceView {
  const entry = entryOf(row);
  if (!isTextList(row.primary_themes) || !isTextList(row.secondary_themes)
    || (row.publisher_label_mode !== 'PSEUDONYM' && row.publisher_label_mode !== 'REAL_NAME')
    || (row.publisher_display_label !== null && typeof row.publisher_display_label !== 'string')
    || typeof row.published_at !== 'string' || !isCount(row.discussion_post_count) || !isCount(row.qandeel_response_count)
    || !Array.isArray(content)) return unavailable();
  // The Experience went dark between the reads: one neutral absence, never a partial panel.
  if (content.length === 0) return { state: 'UNAVAILABLE' };
  const items = content.map((item) => {
    if (!Number.isInteger(item.item_ordinal) || (item.item_kind !== 'SOURCE_CONTENT' && item.item_kind !== 'ANALYSIS') || typeof item.item_text !== 'string') {
      return unavailable();
    }
    return { ordinal: item.item_ordinal, kind: item.item_kind, text: item.item_text };
  });
  return {
    state: 'SERVED',
    experience: {
      ...entry, primaryThemes: [...row.primary_themes], secondaryThemes: [...row.secondary_themes],
      publisher: { mode: row.publisher_label_mode, label: row.publisher_display_label }, publishedAt: row.published_at,
      discussionCount: row.discussion_post_count, qandeelResponseCount: row.qandeel_response_count,
    },
    content: items,
    nearby: entriesOf(nearby, PUBLIC_NEARBY_MAX).filter((near) => near.id !== entry.id),
  };
}
