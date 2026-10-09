import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError, SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { isCanonicalCoordinateText } from '../public-world/public-spatial-placer';
import { SharedWorldRepository } from './shared-world.repository';

/** Exactly the migration 0148 member-read shapes. */
interface SharedFieldRow { readonly place_id: string; readonly world_x: string; readonly world_y: string; readonly meaning: string; readonly semantic_region: string }
interface SharedPlaceRow extends SharedFieldRow { readonly primary_themes: string[]; readonly secondary_themes: string[]; readonly established_at: string }
interface SharedPlaceSourceRow {
  readonly material_id: string; readonly producer_kind: 'HUMAN' | 'QANDEEL'; readonly is_self: boolean; readonly author_name: string | null;
  readonly text_body: string; readonly established_at: string;
}

/** One place in the Shared field: its exact place (integer text), its meaning and its semantic region. */
export interface SharedFieldPlaceView { readonly placeId: string; readonly x: string; readonly y: string; readonly meaning: string; readonly region: string }
/** One source of a place, attributed exactly as the conversation attributes it. */
export interface SharedPlaceSourceView {
  readonly materialId: string; readonly producer: 'SELF' | 'HUMAN' | 'QANDEEL'; readonly authorName: string | null; readonly text: string; readonly establishedAt: string;
}
export type SharedFieldView = { readonly outcome: 'ALLOW'; readonly places: ReadonlyArray<SharedFieldPlaceView> } | { readonly outcome: 'UNAVAILABLE' };
export type SharedPlaceView =
  | { readonly outcome: 'ALLOW'; readonly place: SharedFieldPlaceView & {
    readonly primaryThemes: ReadonlyArray<string>; readonly secondaryThemes: ReadonlyArray<string>; readonly establishedAt: string;
    readonly sources: ReadonlyArray<SharedPlaceSourceView>;
  } }
  | { readonly outcome: 'ABSENT' }
  | { readonly outcome: 'UNAVAILABLE' };

/** The database's bounds: at most 400 places per World read, 24 sources per place. */
export const SHARED_FIELD_MAX = 400;
export const SHARED_PLACE_SOURCES_MAX = 24;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const unavailable = (): never => { throw new ServiceUnavailableException('Shared World is unavailable.'); };
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');

function placeOf(row: SharedFieldRow): SharedFieldPlaceView {
  if (typeof row?.place_id !== 'string' || !UUID.test(row.place_id) || !isCanonicalCoordinateText(row.world_x) || !isCanonicalCoordinateText(row.world_y)
    || typeof row.meaning !== 'string' || row.meaning.length === 0 || typeof row.semantic_region !== 'string' || row.semantic_region.length === 0) return unavailable();
  return { placeId: row.place_id, x: row.world_x, y: row.world_y, meaning: row.meaning, region: row.semantic_region };
}

function sourceOf(row: SharedPlaceSourceRow): SharedPlaceSourceView {
  if (typeof row?.material_id !== 'string' || !UUID.test(row.material_id) || typeof row.text_body !== 'string' || typeof row.established_at !== 'string') return unavailable();
  if (row.producer_kind === 'QANDEEL') return { materialId: row.material_id, producer: 'QANDEEL', authorName: null, text: row.text_body, establishedAt: row.established_at };
  if (row.producer_kind !== 'HUMAN') return unavailable();
  const self = row.is_self === true;
  return { materialId: row.material_id, producer: self ? 'SELF' : 'HUMAN', authorName: self ? null : row.author_name ?? null, text: row.text_body, establishedAt: row.established_at };
}

/**
 * SHARED-VIS-01 — the Shared World's Living Analysis geography: the places of ONE World and one place with its exact
 * sources, over migration 0148 on the caller's own token. Nothing of a World is returned before the S4-01 entry verdict is
 * ALLOW, and then only what the database serves this reader now: a place whose every source the reader may see. A place
 * that is not served — another World's, a source deleted, a source the reader cannot see, a guessed id — is one neutral
 * ABSENT, never a reason. Nothing ranks, counts or is logged.
 */
@Injectable()
export class SharedSemanticFieldService {
  constructor(private readonly shared: SharedWorldRepository, private readonly dataApi: SupabaseDataApiService) {}

  private async rpc<T>(token: string, name: string, body: Record<string, unknown>): Promise<T[]> {
    const rows = await this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
    return Array.isArray(rows) ? rows : [];
  }

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      if (error instanceof DataApiError && error.status === 400) throw new BadRequestException({ outcome: 'INVALID_REQUEST' });
      return unavailable();
    }
  }

  /** True only when the S4-01 entry verdict for this exact World is ALLOW now. */
  private async allowed(token: string, worldId: string): Promise<boolean> {
    const [verdict] = await this.shared.resolveEntry(token, worldId);
    return verdict?.outcome === 'ALLOW' && verdict.world_id === worldId;
  }

  field(token: string, worldId: string): Promise<SharedFieldView> {
    if (!UUID.test(worldId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      if (!(await this.allowed(token, worldId))) return { outcome: 'UNAVAILABLE' };
      const rows = await this.rpc<SharedFieldRow>(token, 'list_own_shared_semantic_field_v1', { p_world_id: worldId });
      if (rows.length > SHARED_FIELD_MAX) return unavailable();
      return { outcome: 'ALLOW', places: rows.map(placeOf) };
    });
  }

  place(token: string, worldId: string, placeId: string): Promise<SharedPlaceView> {
    if (!UUID.test(worldId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    if (!UUID.test(placeId)) return Promise.resolve({ outcome: 'ABSENT' });
    return this.guard(async () => {
      if (!(await this.allowed(token, worldId))) return { outcome: 'UNAVAILABLE' };
      const [rows, sourceRows] = await Promise.all([
        this.rpc<SharedPlaceRow>(token, 'read_own_shared_semantic_place_v1', { p_world_id: worldId, p_place_id: placeId }),
        this.rpc<SharedPlaceSourceRow>(token, 'list_own_shared_semantic_place_sources_v1', { p_world_id: worldId, p_place_id: placeId }),
      ]);
      const [row] = rows;
      // Served now, or not at all: a place without its sources (one was deleted between the two reads) is not served.
      if (row === undefined || rows.length !== 1 || sourceRows.length === 0) return { outcome: 'ABSENT' };
      if (sourceRows.length > SHARED_PLACE_SOURCES_MAX || !isTextList(row.primary_themes) || !isTextList(row.secondary_themes)
        || typeof row.established_at !== 'string') return unavailable();
      return {
        outcome: 'ALLOW',
        place: { ...placeOf(row), primaryThemes: row.primary_themes, secondaryThemes: row.secondary_themes, establishedAt: row.established_at, sources: sourceRows.map(sourceOf) },
      };
    });
  }
}
