import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  PUBLIC_SPATIAL_PLACEMENT_CONTRACT, PUBLIC_SPATIAL_PLACER, decodePublicSpatialPlacement, type PublicSpatialPlacementInput,
  type PublicSpatialPlacer,
} from './public-spatial-placer';
import type { PublicSpatialInputRow } from './public-spatial.repository';
import { PublicSpatialRepository } from './public-spatial.repository';

export interface PublicSpatialPreparationView { readonly state: 'NOT_SEMANTICALLY_READY' | 'NOT_PLACED' | 'PLACED' | 'UNAVAILABLE' }
export interface PublicSpatialPrepareView {
  readonly outcome: 'PLACED' | 'ALREADY_PLACED' | 'PLACEMENT_UNAVAILABLE' | 'NOT_SEMANTICALLY_READY' | 'STALE' | 'UNAVAILABLE';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** One placer call is bounded: a hung provider is an unavailable placement, never a hung request. */
export const SPATIAL_PLACEMENT_TIMEOUT_MS = 20_000;
const STATES: readonly string[] = ['NOT_SEMANTICALLY_READY', 'NOT_PLACED', 'PLACED'];

const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Public placement is unavailable.'); };
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');

/**
 * S5-03B — preparing the stable Public location of a semantically ready Experience, before any publication:
 *
 *   - the exact controller's view of the preparation: whether the place exists — never where it is;
 *   - the request: the controller asks, on their own token; the MEANING-ONLY input is read and the placer's answer
 *     committed on the server channel. The owner can correct meaning (S5-03A); they cannot drag the Experience to a
 *     place, and no body here carries a coordinate, a region, a rank, a neighbour, a model or a readiness.
 *
 * The placer sees the reviewed meaning the database served and nothing else: this service holds no package text, no
 * Personal, Shared, memory, Human Intelligence, account or alias context to give it. A committed place is never moved:
 * a retry or a later model reads it back. Nothing here publishes; nothing here is logged.
 */
@Injectable()
export class PublicSpatialService {
  constructor(
    private readonly repository: PublicSpatialRepository,
    @Inject(PUBLIC_SPATIAL_PLACER) private readonly placer: PublicSpatialPlacer,
  ) {}

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }

  preparation(token: string, experienceId: string): Promise<PublicSpatialPreparationView> {
    if (!isUuid(experienceId)) return Promise.resolve({ state: 'UNAVAILABLE' });
    return this.guard(async () => {
      const rows = await this.repository.preparation(token, experienceId);
      if (!Array.isArray(rows)) return unavailable();
      // No row: not this human's Experience, or none at all. One neutral answer.
      if (rows.length === 0) return { state: 'UNAVAILABLE' };
      if (rows.length !== 1 || !STATES.includes(rows[0].preparation_state)) return unavailable();
      return { state: rows[0].preparation_state as PublicSpatialPreparationView['state'] };
    });
  }

  prepare(token: string, experienceId: string, body: unknown): Promise<PublicSpatialPrepareView> {
    const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
    if (!value || Object.keys(value).some((key) => key !== 'commandId') || !isUuid(value.commandId)) invalid();
    if (!isUuid(experienceId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      const [opened] = await this.repository.request(token, value!.commandId as string, experienceId);
      if (!opened) return unavailable();
      switch (opened.outcome) {
        case 'ALREADY_PLACED': case 'NOT_SEMANTICALLY_READY': case 'STALE': case 'UNAVAILABLE': return { outcome: opened.outcome };
        case 'REQUEST_OPEN': break;
        default: return unavailable();
      }
      if (!isUuid(opened.request_id)) return unavailable();
      return { outcome: await this.place(opened.request_id) };
    });
  }

  // ------------------------------------------------------------------------------------------- the server channel

  private async place(requestId: string): Promise<PublicSpatialPrepareView['outcome']> {
    const input = inputOf(await this.repository.placementInput(requestId));
    // No input: the revision was placed meanwhile, or is no longer current. Ask the request again next time.
    if (input === null) return 'STALE';
    const placement = decodePublicSpatialPlacement(await this.call((signal) => this.placer.place(input, signal)));
    if (!placement) return 'PLACEMENT_UNAVAILABLE';
    const [committed] = await this.repository.commit(requestId, placement.layoutVersion, placement.x, placement.y).catch(() => [] as const);
    switch (committed?.outcome) {
      case 'PLACED': return 'PLACED';
      case 'ALREADY_PLACED': return 'ALREADY_PLACED';
      case 'STALE': case 'UNAVAILABLE': return committed.outcome;
      default: return 'PLACEMENT_UNAVAILABLE';
    }
  }

  /** One bounded placer attempt. Any failure — unavailable, refused, timed out — is no answer. */
  private async call(attempt: (signal: AbortSignal) => Promise<unknown>): Promise<unknown> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        attempt(controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, SPATIAL_PLACEMENT_TIMEOUT_MS);
        }),
      ]);
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/** The meaning-only input exactly as the database served it, decoded strictly; null when there is none to serve. */
function inputOf(rows: readonly PublicSpatialInputRow[]): PublicSpatialPlacementInput | null {
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const [row] = rows;
  if (!isUuid(row.interpretation_id) || typeof row.meaning !== 'string' || row.meaning.length === 0 || !isTextList(row.primary_themes)
    || row.primary_themes.length === 0 || !isTextList(row.secondary_themes) || typeof row.semantic_region !== 'string'
    || row.semantic_region.length === 0) return null;
  return Object.freeze({
    contract: PUBLIC_SPATIAL_PLACEMENT_CONTRACT, semanticRevision: row.interpretation_id, meaning: row.meaning,
    primaryThemes: Object.freeze([...row.primary_themes]), secondaryThemes: Object.freeze([...row.secondary_themes]),
    semanticRegion: row.semantic_region,
  });
}
