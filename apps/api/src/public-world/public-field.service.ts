import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { isCanonicalCoordinateText } from './public-spatial-placer';
import { TOPIC_SECTIONS, topicItemsOf, topicPageOf, type TopicSection } from './public-compose.service';
import type { PublicFieldEntryRow, PublicFieldExperienceRow, PublicFieldRelationRow, PublicTopicHeaderRow, PublicTopicItemsRow } from './public-field.repository';
import { PublicFieldRepository } from './public-field.repository';

/**
 * One Experience in the field: its place (exact integer text), its reviewed meaning and its semantic region — and, for a
 * topic its author wrote (S8A-05 CP1, migration 0179), its human title and section, which a client shows in place of the
 * meaning. An Experience with no human title (every one before 0179) carries neither key and keeps showing its meaning.
 */
export interface PublicFieldEntryView {
  readonly id: string; readonly x: string; readonly y: string; readonly meaning: string; readonly region: string;
  readonly title?: string; readonly section?: TopicSection;
}
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
    /**
     * The first page (at most 50) of the Experience's content, each item with its 0145 kind. S8A-05 CP2: an item of a
     * topic made from a conversation or a «فهم قنديل» item also carries the role its topic sealed — the author's own
     * message, QANDEEL's reply, QANDEEL's understanding or the author's written words — its message ordinal, its
     * emphasis and whether a gap precedes it. The rest is read page by page (GET …/items?page=N), never all at once.
     */
    readonly content: ReadonlyArray<PublicFieldContentItemView>;
    readonly contentPages: { readonly itemCount: number; readonly pageCount: number };
    readonly nearby: ReadonlyArray<PublicFieldEntryView>;
    /**
     * S5-03C: the Experience's ACTIVE explicit relations, each the OTHER endpoint's served entry and the relation's id.
     * Only relations whose two bound endpoints are both served now; empty when there are none. Similarity adds nothing.
     */
    readonly relations: ReadonlyArray<{ readonly relationId: string; readonly other: PublicFieldEntryView }>;
  };

export type PublicTopicItemRole = 'WRITTEN' | 'YOUR_MESSAGE' | 'QANDEEL_REPLY' | 'QANDEEL_UNDERSTANDING';
export interface PublicFieldContentItemView {
  readonly ordinal: number; readonly kind: 'SOURCE_CONTENT' | 'ANALYSIS'; readonly text: string;
  readonly role?: PublicTopicItemRole; readonly message?: number | null; readonly emphasized?: boolean; readonly gapBefore?: boolean;
}
/** S8A-05 CP2 — one page of a served Experience's content. */
export type PublicTopicItemsView =
  | { readonly state: 'UNAVAILABLE' }
  | { readonly state: 'SERVED'; readonly itemCount: number; readonly page: number; readonly pageCount: number; readonly items: ReadonlyArray<PublicFieldContentItemView> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** The database's bounds: at most 400 field entries, 20 search results, 3 nearby. */
export const PUBLIC_FIELD_MAX = 400;
export const PUBLIC_SEARCH_MAX = 20;
export const PUBLIC_NEARBY_MAX = 3;
/** S5-03C: at most 24 explicit relations of one Experience per read. */
export const PUBLIC_RELATIONS_PER_EXPERIENCE_MAX = 24;
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
export type TopicHeaders = ReadonlyMap<string, { readonly title: string; readonly section: TopicSection | null }>;
type Headers = TopicHeaders;
/** S8A-05 CP1: the 0179 header rows, strictly — only for ids asked, a non-empty title, a known section. */
function headersOf(rows: readonly PublicTopicHeaderRow[], asked: ReadonlySet<string>): Headers {
  if (!Array.isArray(rows) || rows.length > asked.size) return unavailable();
  const headers = new Map<string, { title: string; section: TopicSection | null }>();
  for (const row of rows) {
    if (!isUuid(row?.experience_id) || !asked.has(row.experience_id) || headers.has(row.experience_id)
      || (row.section_key !== null && !(TOPIC_SECTIONS as readonly string[]).includes(row.section_key))) return unavailable();
    if (row.title === null) continue;
    if (typeof row.title !== 'string' || row.title.length === 0) return unavailable();
    headers.set(row.experience_id, { title: row.title, section: row.section_key as TopicSection | null });
  }
  return headers;
}
function titled(entry: PublicFieldEntryView, headers: Headers): PublicFieldEntryView {
  const header = headers.get(entry.id);
  if (!header) return entry;
  return header.section ? { ...entry, title: header.title, section: header.section } : { ...entry, title: header.title };
}
/**
 * S8A-05 CP1: the human titles (and sections) of the served topics among `ids`, in one bounded read; no read for no id.
 * Shared by every Public surface that names an Experience (the field, its search and panel, the relations list), so a
 * topic is named by its author's title wherever it appears.
 */
export async function readTopicHeaders(repository: Pick<PublicFieldRepository, 'topicHeaders'>, token: string, ids: Iterable<string>): Promise<TopicHeaders> {
  const asked = new Set(ids);
  if (asked.size === 0) return new Map();
  return headersOf(await repository.topicHeaders(token, [...asked]), asked);
}

/**
 * S5-03B — «العالم العام» / Public World as a World: the semantic field the viewer explores, search over the SAME field,
 * and the contextual panel of one Experience in it.
 *
 * Every answer is decided by the database for the viewer's own token: admission, canonical visibility, the exact visible
 * version, its reviewed S5-03A meaning and its current place. An Experience that is not served — hidden, stale, guessed,
 * or a viewer not admitted — is one neutral absence, never a reason. Nothing here ranks by popularity or views, invents
 * a count or publishes; nothing is logged. The only relation it serves is an EXPLICIT one (S5-03C): an accepted human
 * relation whose two bound endpoints the database serves now — never a similarity, a proximity or a shared region.
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

  /** S8A-05 CP1: the human titles of the entries about to be shown, in one bounded read; no read for no entry. */
  private titles(token: string, entries: readonly PublicFieldEntryView[]): Promise<Headers> {
    return readTopicHeaders(this.repository, token, entries.map((entry) => entry.id));
  }

  /** The field inside one world rectangle: exactly { minX, minY, maxX, maxY }, exact integer text, min ≤ max. */
  field(token: string, query: unknown): Promise<PublicFieldView> {
    const value = query && typeof query === 'object' && !Array.isArray(query) ? query as Record<string, unknown> : {};
    const keys = ['minX', 'minY', 'maxX', 'maxY'];
    if (Object.keys(value).length !== keys.length || !keys.every((key) => isCanonicalCoordinateText(value[key]))) invalid();
    const [minX, minY, maxX, maxY] = keys.map((key) => value[key] as string);
    if (BigInt(minX) > BigInt(maxX) || BigInt(minY) > BigInt(maxY)) invalid();
    return this.guard(async () => {
      const experiences = entriesOf(await this.repository.field(token, minX, minY, maxX, maxY), PUBLIC_FIELD_MAX);
      const headers = await this.titles(token, experiences);
      return { experiences: experiences.map((entry) => titled(entry, headers)) };
    });
  }

  /**
   * Search over the same field: exactly { q } or { q, section }, q one trimmed line of 1–120 characters. S8A-05 CP1: a
   * topic whose human title matches comes first, then the matches of the reviewed meaning, themes and public text (the
   * topic's own words), each Experience once, at most 20. With a section, only that section's topics are searched (title,
   * meaning, themes and text in one read).
   */
  search(token: string, query: unknown): Promise<PublicFieldSearchView> {
    const value = query && typeof query === 'object' && !Array.isArray(query) ? query as Record<string, unknown> : {};
    const { q, section } = value;
    const keys = Object.keys(value);
    if (keys.length !== (section === undefined ? 1 : 2) || typeof q !== 'string' || q.length < 1 || q.length > PUBLIC_SEARCH_QUERY_MAX || q !== q.trim()
      || /[\n\r\t]/u.test(q) || (section !== undefined && !(TOPIC_SECTIONS as readonly unknown[]).includes(section))) invalid();
    return this.guard(async () => {
      const results = section !== undefined
        ? entriesOf(await this.repository.sectionSearch(token, q as string, section as TopicSection), PUBLIC_SEARCH_MAX)
        : await this.fieldSearch(token, q as string);
      const headers = await this.titles(token, results);
      return { results: results.map((entry) => titled(entry, headers)) };
    });
  }

  private async fieldSearch(token: string, q: string): Promise<PublicFieldEntryView[]> {
    const [byTitle, byMeaning] = await Promise.all([this.repository.titleSearch(token, q), this.repository.search(token, q)]);
    const seen = new Set<string>();
    return [...entriesOf(byTitle, PUBLIC_SEARCH_MAX), ...entriesOf(byMeaning, PUBLIC_SEARCH_MAX)]
      .filter((entry) => (seen.has(entry.id) ? false : (seen.add(entry.id), true))).slice(0, PUBLIC_SEARCH_MAX);
  }

  /** The contextual panel of one Experience the field showed: its meaning, public display, content and nearby context. */
  experience(token: string, experienceId: string): Promise<PublicFieldExperienceView> {
    if (!isUuid(experienceId)) return Promise.resolve({ state: 'UNAVAILABLE' });
    return this.guard(async () => {
      const rows = await this.repository.experience(token, experienceId);
      if (!Array.isArray(rows) || rows.length > 1) return unavailable();
      if (rows.length === 0) return { state: 'UNAVAILABLE' as const };
      const [content, nearby, relations] = await Promise.all([this.repository.topicItems(token, experienceId, 1),
        this.repository.nearby(token, experienceId), this.repository.relations(token, experienceId)]);
      const served = servedOf(rows[0], content, nearby, relations);
      if (served.state !== 'SERVED') return served;
      const headers = await this.titles(token, [served.experience, ...served.nearby, ...served.relations.map((relation) => relation.other)]);
      return { ...served, experience: titled(served.experience, headers) as typeof served.experience, nearby: served.nearby.map((near) => titled(near, headers)),
        relations: served.relations.map((relation) => ({ ...relation, other: titled(relation.other, headers) })) };
    });
  }

  /** S8A-05 CP2 — one page of 50 of a served Experience's content, in its sealed order; nothing for anything not served. */
  items(token: string, experienceId: string, query: unknown): Promise<PublicTopicItemsView> {
    const page = topicPageOf(query);
    if (!isUuid(experienceId)) return Promise.resolve({ state: 'UNAVAILABLE' });
    return this.guard(async () => {
      const pages = pageOf(await this.repository.topicItems(token, experienceId, page), page);
      return pages === null ? { state: 'UNAVAILABLE' as const } : { state: 'SERVED' as const, ...pages };
    });
  }
}

const READER_ROLES = ['WRITTEN', 'YOUR_MESSAGE', 'QANDEEL_REPLY', 'QANDEEL_UNDERSTANDING', 'SOURCE_CONTENT', 'ANALYSIS'] as const;
/** One page of a served Experience's content: the 0145 kind of every item, and the sealed role of a CP2 topic's. */
function pageOf(rows: readonly PublicTopicItemsRow[], page: number): { itemCount: number; page: number; pageCount: number; items: PublicFieldContentItemView[] } | null {
  if (!Array.isArray(rows) || rows.length > 1) return unavailable();
  // The Experience is not served (or went dark between the reads): one neutral absence, never a partial panel.
  if (rows.length === 0) return null;
  const [row] = rows;
  if (!isCount(row.item_count) || row.item_count === 0 || row.page !== page || !isCount(row.page_count) || row.page_count < 1) return unavailable();
  const items = topicItemsOf(row.items, READER_ROLES, 'READER').map((item): PublicFieldContentItemView => {
    if (item.role === 'SOURCE_CONTENT' || item.role === 'ANALYSIS') return { ordinal: item.position, kind: item.role, text: item.text };
    return { ordinal: item.position, kind: item.role === 'QANDEEL_REPLY' || item.role === 'QANDEEL_UNDERSTANDING' ? 'ANALYSIS' : 'SOURCE_CONTENT',
      text: item.text, role: item.role, message: item.message, emphasized: item.emphasized, gapBefore: item.gapBefore };
  });
  return { itemCount: row.item_count, page, pageCount: row.page_count, items };
}

function servedOf(row: PublicFieldExperienceRow, content: readonly PublicTopicItemsRow[], nearby: readonly PublicFieldEntryRow[],
  relations: readonly PublicFieldRelationRow[]): PublicFieldExperienceView {
  const entry = entryOf(row);
  if (!isTextList(row.primary_themes) || !isTextList(row.secondary_themes)
    || (row.publisher_label_mode !== 'PSEUDONYM' && row.publisher_label_mode !== 'REAL_NAME')
    || (row.publisher_display_label !== null && typeof row.publisher_display_label !== 'string')
    || typeof row.published_at !== 'string' || !isCount(row.discussion_post_count) || !isCount(row.qandeel_response_count)
    || !Array.isArray(content) || !Array.isArray(relations) || relations.length > PUBLIC_RELATIONS_PER_EXPERIENCE_MAX) return unavailable();
  const first = pageOf(content, 1);
  if (first === null) return { state: 'UNAVAILABLE' };
  return {
    state: 'SERVED',
    experience: {
      ...entry, primaryThemes: [...row.primary_themes], secondaryThemes: [...row.secondary_themes],
      publisher: { mode: row.publisher_label_mode, label: row.publisher_display_label }, publishedAt: row.published_at,
      discussionCount: row.discussion_post_count, qandeelResponseCount: row.qandeel_response_count,
    },
    content: first.items,
    contentPages: { itemCount: first.itemCount, pageCount: first.pageCount },
    nearby: entriesOf(nearby, PUBLIC_NEARBY_MAX).filter((near) => near.id !== entry.id),
    relations: relations.map((relation) => (isUuid(relation?.relation_id) ? { relationId: relation.relation_id, other: entryOf(relation) } : unavailable()))
      .filter((relation) => relation.other.id !== entry.id),
  };
}
