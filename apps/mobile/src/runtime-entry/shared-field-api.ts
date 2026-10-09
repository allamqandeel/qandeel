/**
 * SHARED-VIS-01 — the Shared World's Living Analysis geography, on the S4-01 Shared transport
 * (`SharedWorldApiClient.field` / `SharedWorldApiClient.place`).
 *
 *   GET /shared/worlds/:worldId/field                    — the entry verdict, then the places of this World the reader may see
 *   GET /shared/worlds/:worldId/field/places/:placeId    — the entry verdict, then one place with its themes and exact sources
 *
 * Decoders only: a place travels as exact integer text and is decoded into an exact canonical world address — never a
 * float — in THIS World's own coordinate space. Anything else is no answer. Nothing is sent but the World and a place the
 * field showed.
 */
import { canonicalWorldAddress, isCanonicalCoordinateText, parseCanonicalCoordinate, type CanonicalWorldAddress } from '../map/world';

/** One place of a Shared World: its exact place, its meaning and its semantic region (never shown as text). */
export interface SharedFieldEntry {
  readonly id: string;
  readonly address: CanonicalWorldAddress;
  readonly meaning: string;
  readonly region: string;
}
/** One source of a place, attributed exactly as the conversation attributes it. */
export interface SharedPlaceSource {
  readonly materialId: string;
  readonly producer: 'SELF' | 'HUMAN' | 'QANDEEL';
  readonly authorName: string | null;
  readonly text: string;
  readonly establishedAt: string;
}
export interface SharedFieldPlace {
  readonly entry: SharedFieldEntry;
  readonly primaryThemes: readonly string[];
  readonly secondaryThemes: readonly string[];
  readonly establishedAt: string;
  readonly sources: readonly SharedPlaceSource[];
}
export type SharedFieldResult =
  | { readonly kind: 'READ'; readonly entries: readonly SharedFieldEntry[] }
  /** Not this reader's World now — one neutral answer that reveals nothing. */
  | { readonly kind: 'DENIED' }
  | { readonly kind: 'UNAVAILABLE' };
export type SharedPlaceResult =
  | { readonly kind: 'READ'; readonly place: SharedFieldPlace }
  /** Not served now — gone, a source deleted or not the reader's to see, or never there. The field never learns why. */
  | { readonly kind: 'ABSENT' }
  | { readonly kind: 'DENIED' }
  | { readonly kind: 'UNAVAILABLE' };

/** The server's bounds: at most 400 places per World read, 24 sources per place. */
export const SHARED_FIELD_MAX = 400;
export const SHARED_PLACE_SOURCES_MAX = 24;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.length > 0);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};

function addressOf(x: unknown, y: unknown): CanonicalWorldAddress | null {
  if (!isCanonicalCoordinateText(x) || !isCanonicalCoordinateText(y)) return null;
  const px = parseCanonicalCoordinate(x, 'x');
  const py = parseCanonicalCoordinate(y, 'y');
  if (!px.ok || !py.ok) return null;
  const address = canonicalWorldAddress(px.value, py.value);
  return address.ok ? address.address : null;
}

function entryOf(value: unknown): SharedFieldEntry | null {
  if (!isRecord(value) || !isUuid(value.placeId) || typeof value.meaning !== 'string' || value.meaning.length === 0
    || typeof value.region !== 'string' || value.region.length === 0) return null;
  const address = addressOf(value.x, value.y);
  return address ? Object.freeze({ id: value.placeId, address, meaning: value.meaning, region: value.region }) : null;
}

function sourceOf(value: unknown): SharedPlaceSource | null {
  if (!isRecord(value) || !hasExactly(value, ['materialId', 'producer', 'authorName', 'text', 'establishedAt']) || !isUuid(value.materialId)
    || (value.producer !== 'SELF' && value.producer !== 'HUMAN' && value.producer !== 'QANDEEL')
    || (value.authorName !== null && typeof value.authorName !== 'string') || typeof value.text !== 'string' || typeof value.establishedAt !== 'string') return null;
  return Object.freeze({ materialId: value.materialId, producer: value.producer, authorName: value.authorName as string | null, text: value.text, establishedAt: value.establishedAt });
}

/** The field of one World, strictly: exactly { outcome: 'ALLOW', places } (each exactly five fields), or one neutral denial. */
export function decodeSharedField(body: unknown): SharedFieldResult {
  if (!isRecord(body)) return { kind: 'UNAVAILABLE' };
  if (hasExactly(body, ['outcome']) && body.outcome === 'UNAVAILABLE') return { kind: 'DENIED' };
  if (body.outcome !== 'ALLOW' || !hasExactly(body, ['outcome', 'places']) || !Array.isArray(body.places) || body.places.length > SHARED_FIELD_MAX) {
    return { kind: 'UNAVAILABLE' };
  }
  const entries: SharedFieldEntry[] = [];
  for (const place of body.places) {
    if (!isRecord(place) || !hasExactly(place, ['placeId', 'x', 'y', 'meaning', 'region'])) return { kind: 'UNAVAILABLE' };
    const entry = entryOf(place);
    if (entry === null) return { kind: 'UNAVAILABLE' };
    entries.push(entry);
  }
  return { kind: 'READ', entries: Object.freeze(entries) };
}

/** One place, strictly, or one neutral ABSENT / denial. */
export function decodeSharedPlace(body: unknown, placeId: string): SharedPlaceResult {
  if (!isRecord(body)) return { kind: 'UNAVAILABLE' };
  if (hasExactly(body, ['outcome']) && body.outcome === 'UNAVAILABLE') return { kind: 'DENIED' };
  if (hasExactly(body, ['outcome']) && body.outcome === 'ABSENT') return { kind: 'ABSENT' };
  if (body.outcome !== 'ALLOW' || !hasExactly(body, ['outcome', 'place']) || !isRecord(body.place)) return { kind: 'UNAVAILABLE' };
  const p = body.place;
  if (!hasExactly(p, ['placeId', 'x', 'y', 'meaning', 'region', 'primaryThemes', 'secondaryThemes', 'establishedAt', 'sources']) || p.placeId !== placeId
    || !isTextList(p.primaryThemes) || !isTextList(p.secondaryThemes) || typeof p.establishedAt !== 'string'
    || !Array.isArray(p.sources) || p.sources.length === 0 || p.sources.length > SHARED_PLACE_SOURCES_MAX) return { kind: 'UNAVAILABLE' };
  const entry = entryOf(p);
  const sources = p.sources.map(sourceOf);
  if (entry === null || !sources.every((source): source is SharedPlaceSource => source !== null)) return { kind: 'UNAVAILABLE' };
  return {
    kind: 'READ',
    place: Object.freeze({
      entry, primaryThemes: Object.freeze([...p.primaryThemes]), secondaryThemes: Object.freeze([...p.secondaryThemes]),
      establishedAt: p.establishedAt, sources: Object.freeze(sources),
    }),
  };
}
