/**
 * S5-03B — the clients for the «العالم العام» / Public World semantic field and for preparing an Experience's stable place,
 * beside the S5-01 / S5-02 / S5-03A clients on the same identity-bound transport (`PublicWorldApiClient.field` and
 * `PublicWorldApiClient.spatial`).
 *
 *   GET  /public/field?minX&minY&maxX&maxY        the Experiences placed inside one world rectangle
 *   GET  /public/field/search?q                   search over the same field; each result carries its place
 *   GET  /public/field/experiences/:id            the contextual panel of one Experience the field showed, with its explicit
 *                                                 relations (S5-03C): the other endpoint of each ACTIVE relation the server
 *                                                 serves now — never a similarity
 *   GET  /public/authoring/drafts/:id/place       whether the reader's own Experience has its place (never where)
 *   POST /public/authoring/drafts/:id/place       { commandId } → ask QANDEEL to prepare it
 *
 * A transport and nothing else: no credential of its own, no viewer id, no audience, no visibility, no region, no rank, no
 * retry. A place travels as exact integer text and is decoded into an exact canonical world address — never a float. The
 * only things sent are navigation (a rectangle, a query, an id the field showed) and one command id. Nothing can publish.
 */
import type { CanonicalWorldAddress } from '../map/world';
import { canonicalWorldAddress, isCanonicalCoordinateText, parseCanonicalCoordinate } from '../map/world';
import type { PublicAuthoringAnswer, PublicAuthoringApiConfig } from './public-authoring-api';

/** One Experience in the field: its exact place, its reviewed meaning and its semantic region (never shown as text). */
export interface PublicFieldEntry {
  readonly id: string;
  readonly address: CanonicalWorldAddress;
  readonly meaning: string;
  readonly region: string;
}
export interface PublicFieldRectangle { readonly minX: bigint; readonly minY: bigint; readonly maxX: bigint; readonly maxY: bigint }
export interface PublicFieldExperience {
  readonly entry: PublicFieldEntry;
  readonly primaryThemes: ReadonlyArray<string>;
  readonly secondaryThemes: ReadonlyArray<string>;
  readonly publisher: { readonly mode: 'PSEUDONYM' | 'REAL_NAME'; readonly label: string | null };
  /** S5-04 (D7): the publication instant, shown as a date in the panel. */
  readonly publishedAt: string;
  /**
   * S5-04 (D7): the human discussion count of the served version, shown ONLY inside the Discussion entry. The Public
   * QANDEEL response count is decoded and dropped: it is never a social metric. Neither moves anything in the field.
   */
  readonly discussionCount: number;
  readonly content: ReadonlyArray<{ readonly ordinal: number; readonly kind: 'SOURCE_CONTENT' | 'ANALYSIS'; readonly text: string }>;
  readonly nearby: ReadonlyArray<PublicFieldEntry>;
  /**
   * S5-03C: the Experience's ACTIVE explicit relations whose two bound endpoints the server serves now — each the OTHER
   * endpoint's served entry and the relation's identity. Empty when there is none: proximity and a shared region are
   * not relations.
   */
  readonly relations: ReadonlyArray<PublicFieldRelation>;
}
/** S5-03C: one explicit relation as the field draws it — its identity and the other endpoint's served place. */
export interface PublicFieldRelation { readonly relationId: string; readonly other: PublicFieldEntry }
/** SERVED, or one neutral absence: hidden, stale, gone or never there — the field never learns why. */
export type PublicFieldPanel = { readonly kind: 'SERVED'; readonly experience: PublicFieldExperience } | { readonly kind: 'ABSENT' };
export type PublicSpatialPreparation = 'NOT_SEMANTICALLY_READY' | 'NOT_PLACED' | 'PLACED' | 'UNAVAILABLE';
export type PublicSpatialPrepareOutcome = 'PLACED' | 'ALREADY_PLACED' | 'PLACEMENT_UNAVAILABLE' | 'NOT_SEMANTICALLY_READY' | 'STALE' | 'UNAVAILABLE';

type Exchange = { readonly kind: 'OK'; readonly body: unknown } | { readonly kind: 'STATUS'; readonly status: number } | { readonly kind: 'NETWORK' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};
const NO: { readonly kind: 'NO_ANSWER' } = Object.freeze({ kind: 'NO_ANSWER' as const });
const yes = <T>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });

/** The bounds the server holds the field to; an answer beyond them is no answer. */
export const PUBLIC_FIELD_MAX = 400;
export const PUBLIC_SEARCH_MAX = 20;
export const PUBLIC_NEARBY_MAX = 3;
/** S5-03C: at most 24 explicit relations of one Experience per read. */
export const PUBLIC_RELATIONS_PER_EXPERIENCE_MAX = 24;

function addressOf(x: unknown, y: unknown): CanonicalWorldAddress | null {
  if (!isCanonicalCoordinateText(x) || !isCanonicalCoordinateText(y)) return null;
  const px = parseCanonicalCoordinate(x, 'x');
  const py = parseCanonicalCoordinate(y, 'y');
  if (!px.ok || !py.ok) return null;
  const address = canonicalWorldAddress(px.value, py.value);
  return address.ok ? address.address : null;
}

function entryOf(value: unknown): PublicFieldEntry | null {
  if (!isRecord(value) || !hasExactly(value, ['id', 'x', 'y', 'meaning', 'region']) || !isUuid(value.id)
    || typeof value.meaning !== 'string' || value.meaning.length === 0 || typeof value.region !== 'string' || value.region.length === 0) return null;
  const address = addressOf(value.x, value.y);
  return address ? Object.freeze({ id: value.id, address, meaning: value.meaning, region: value.region }) : null;
}

function entriesOf(value: unknown, max: number): PublicFieldEntry[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const entries = value.map(entryOf);
  return entries.every((entry): entry is PublicFieldEntry => entry !== null) ? entries : null;
}

/** S5-03C: the explicit relations of a served panel, strictly: { relationId, other: entry }, at most 24. */
function relationsOf(value: unknown): PublicFieldRelation[] | null {
  if (!Array.isArray(value) || value.length > PUBLIC_RELATIONS_PER_EXPERIENCE_MAX) return null;
  const relations = value.map((item) => {
    if (!isRecord(item) || !hasExactly(item, ['relationId', 'other']) || !isUuid(item.relationId)) return null;
    const other = entryOf(item.other);
    return other ? Object.freeze({ relationId: item.relationId, other }) : null;
  });
  return relations.every((relation): relation is PublicFieldRelation => relation !== null) ? relations : null;
}

export class PublicFieldApiClient {
  constructor(private readonly config: PublicAuthoringApiConfig) {}

  async field(rectangle: PublicFieldRectangle): Promise<PublicAuthoringAnswer<ReadonlyArray<PublicFieldEntry>>> {
    const query = `minX=${rectangle.minX.toString()}&minY=${rectangle.minY.toString()}&maxX=${rectangle.maxX.toString()}&maxY=${rectangle.maxY.toString()}`;
    const answer = await this.exchange('GET', `/public/field?${query}`);
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['experiences'])) return NO;
    const entries = entriesOf(answer.body.experiences, PUBLIC_FIELD_MAX);
    return entries ? yes(entries) : NO;
  }

  async search(query: string): Promise<PublicAuthoringAnswer<ReadonlyArray<PublicFieldEntry>>> {
    const answer = await this.exchange('GET', `/public/field/search?q=${encodeURIComponent(query)}`);
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['results'])) return NO;
    const entries = entriesOf(answer.body.results, PUBLIC_SEARCH_MAX);
    return entries ? yes(entries) : NO;
  }

  async experience(experienceId: string): Promise<PublicAuthoringAnswer<PublicFieldPanel>> {
    const answer = await this.exchange('GET', `/public/field/experiences/${encodeURIComponent(experienceId)}`);
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return NO;
    const b = answer.body;
    if (b.state === 'UNAVAILABLE' && hasExactly(b, ['state'])) return yes({ kind: 'ABSENT' });
    if (b.state !== 'SERVED' || !hasExactly(b, ['state', 'experience', 'content', 'nearby', 'relations']) || !isRecord(b.experience)) return NO;
    const e = b.experience;
    const entry = entryOf({ id: e.id, x: e.x, y: e.y, meaning: e.meaning, region: e.region });
    const publisher = isRecord(e.publisher) && hasExactly(e.publisher, ['mode', 'label'])
      && (e.publisher.mode === 'PSEUDONYM' || e.publisher.mode === 'REAL_NAME')
      && (e.publisher.label === null || typeof e.publisher.label === 'string') ? e.publisher : null;
    const nearby = entriesOf(b.nearby, PUBLIC_NEARBY_MAX);
    const relations = relationsOf(b.relations);
    if (!entry || !publisher || !isTextList(e.primaryThemes) || !isTextList(e.secondaryThemes) || nearby === null
      || !hasExactly(e, ['id', 'x', 'y', 'meaning', 'region', 'primaryThemes', 'secondaryThemes', 'publisher', 'publishedAt', 'discussionCount', 'qandeelResponseCount'])
      || typeof e.publishedAt !== 'string' || !Number.isFinite(Date.parse(e.publishedAt)) || !isCount(e.discussionCount) || !isCount(e.qandeelResponseCount) || !Array.isArray(b.content)
      || relations === null) return NO;
    const content = b.content.map((item) => (isRecord(item) && hasExactly(item, ['ordinal', 'kind', 'text']) && isCount(item.ordinal)
      && (item.kind === 'SOURCE_CONTENT' || item.kind === 'ANALYSIS') && typeof item.text === 'string'
      ? { ordinal: item.ordinal, kind: item.kind as 'SOURCE_CONTENT' | 'ANALYSIS', text: item.text } : null));
    if (content.length === 0 || !content.every((item) => item !== null)) return NO;
    return yes({ kind: 'SERVED', experience: {
      entry, primaryThemes: [...e.primaryThemes], secondaryThemes: [...e.secondaryThemes],
      publisher: { mode: publisher.mode as 'PSEUDONYM' | 'REAL_NAME', label: publisher.label as string | null },
      publishedAt: e.publishedAt as string, discussionCount: e.discussionCount as number,
      content: content as PublicFieldExperience['content'], nearby: nearby.filter((near) => near.id !== entry.id),
      relations: relations.filter((relation) => relation.other.id !== entry.id),
    } });
  }

  private async exchange(method: 'GET', path: string): Promise<Exchange> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, { method, headers: { Accept: 'application/json' } });
      if (!response.ok) return { kind: 'STATUS', status: response.status };
      return { kind: 'OK', body: (await response.json()) as unknown };
    } catch {
      return { kind: 'NETWORK' };
    }
  }
}

export class PublicSpatialApiClient {
  constructor(private readonly config: PublicAuthoringApiConfig) {}

  async preparation(experienceId: string): Promise<PublicAuthoringAnswer<PublicSpatialPreparation>> {
    const answer = await this.exchange('GET', `/public/authoring/drafts/${encodeURIComponent(experienceId)}/place`);
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['state'])) return NO;
    const state = answer.body.state;
    return state === 'NOT_SEMANTICALLY_READY' || state === 'NOT_PLACED' || state === 'PLACED' || state === 'UNAVAILABLE' ? yes(state) : NO;
  }

  async prepare(experienceId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicSpatialPrepareOutcome>> {
    const answer = await this.exchange('POST', `/public/authoring/drafts/${encodeURIComponent(experienceId)}/place`, { commandId });
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['outcome'])) return NO;
    const outcome = answer.body.outcome;
    return outcome === 'PLACED' || outcome === 'ALREADY_PLACED' || outcome === 'PLACEMENT_UNAVAILABLE' || outcome === 'NOT_SEMANTICALLY_READY'
      || outcome === 'STALE' || outcome === 'UNAVAILABLE' ? yes(outcome) : NO;
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
