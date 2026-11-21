/**
 * COSMOS E-2 corrections, Slice C (the Product Owner's D-5, Option U, 2026-11-20) — the client for the person's own
 * CURRENT Personal World: `GET /conversation/personal-world` (migration 0199), the Threads they have NOW with the ONE
 * canonical Home, the served name (the 0198 law) and where each was established. Beside — never instead of — the
 * Session-bound historical projection: this read carries no Session Position, no Live Head, no lifecycle state and no
 * appearance, and the client refuses a row that claims one.
 *
 * Owner-scoped on the server (`auth.uid()`); this client carries the bearer the seam decides and nothing that names
 * the person. Unknown keys are refused: a world with a hole in it would be a quiet lie about what exists.
 */
import type { CurrentPersonalThread, CurrentPersonalWorld, ThreadNameSource } from '@qandeel/runtime';
import type { RuntimeHttpFetch } from './conversation-session-api';

export type CurrentPersonalWorldOutcome =
  | { readonly kind: 'READ'; readonly world: CurrentPersonalWorld }
  | { readonly kind: 'UNAUTHENTICATED' }
  | { readonly kind: 'UNAVAILABLE'; readonly detail: string };

export interface CurrentPersonalWorldApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const THREAD_KEYS = ['id', 'home', 'name', 'origin'] as const;
const WORLD_KEYS = ['asOf', 'threads'] as const;
const NAME_SOURCES: readonly ThreadNameSource[] = ['USER_ALIAS', 'GROUNDING_WORDING', 'NONE'];
const INTEGER_TEXT = /^-?(?:0|[1-9][0-9]*)$/u;

const exact = (value: unknown, keys: readonly string[]): Record<string, unknown> | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const present = Object.keys(row);
  if (present.length !== keys.length || present.some((key) => !keys.includes(key))) return null;
  return row;
};

function decodeThread(value: unknown): CurrentPersonalThread | null {
  const row = exact(value, THREAD_KEYS);
  if (row === null) return null;
  const home = exact(row.home, ['x', 'y']);
  const name = exact(row.name, ['text', 'source']);
  const origin = exact(row.origin, ['sessionId', 'sp']);
  if (home === null || name === null || origin === null) return null;
  if (typeof row.id !== 'string' || row.id === '') return null;
  if (typeof home.x !== 'string' || typeof home.y !== 'string' || !INTEGER_TEXT.test(home.x) || !INTEGER_TEXT.test(home.y)) return null;
  const source = name.source;
  if (typeof source !== 'string' || !NAME_SOURCES.includes(source as ThreadNameSource)) return null;
  const text = name.text;
  if (text !== null && typeof text !== 'string') return null;
  // The name is a closed pair: text exactly when it has a source.
  if ((source === 'NONE') !== (text === null) || text === '') return null;
  if (typeof origin.sessionId !== 'string' || origin.sessionId === '') return null;
  if (typeof origin.sp !== 'number' || !Number.isSafeInteger(origin.sp) || origin.sp < 1) return null;
  return {
    id: row.id,
    home: { x: home.x, y: home.y },
    name: { text: text as string | null, source: source as ThreadNameSource },
    origin: { sessionId: origin.sessionId, sp: origin.sp },
  };
}

const detailOf = (cause: unknown, fallback: string): string => (cause instanceof Error && cause.message !== '' ? cause.message : fallback);

export class CurrentPersonalWorldApiClient {
  constructor(private readonly config: CurrentPersonalWorldApiConfig) {}

  /** The caller's own current world. Ordered by the server; this client reorders nothing and derives nothing. */
  async read(): Promise<CurrentPersonalWorldOutcome> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/conversation/personal-world`, { method: 'GET', headers: { Accept: 'application/json' } });
    } catch (cause) {
      return { kind: 'UNAVAILABLE', detail: detailOf(cause, 'the request did not complete') };
    }
    if (response.status === 401 || response.status === 403) return { kind: 'UNAUTHENTICATED' };
    if (!response.ok) return { kind: 'UNAVAILABLE', detail: `server responded ${response.status}` };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'UNAVAILABLE', detail: 'the response body could not be read' };
    }
    const row = exact(body, WORLD_KEYS);
    if (row === null || typeof row.asOf !== 'string' || Number.isNaN(Date.parse(row.asOf)) || !Array.isArray(row.threads)) {
      return { kind: 'UNAVAILABLE', detail: 'the current world is malformed' };
    }
    const threads: CurrentPersonalThread[] = [];
    const seen = new Set<string>();
    for (const item of row.threads) {
      const thread = decodeThread(item);
      if (thread === null || seen.has(thread.id)) return { kind: 'UNAVAILABLE', detail: 'a current-world row is malformed' };
      seen.add(thread.id);
      threads.push(thread);
    }
    return { kind: 'READ', world: { asOf: row.asOf, threads } };
  }
}
