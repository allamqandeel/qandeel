/**
 * S5-01 — the client for the «العالم العام» / Public World Product routes.
 *
 *   GET /public/entry    — the Public World entry verdict (ALLOW, or one neutral UNAVAILABLE)
 *   GET /public/display  — the reader's own Public display choice: the mode and the label it renders now
 *   PUT /public/display  — { mode } → the reader chooses PSEUDONYM or REAL_NAME; never label text
 *
 * A transport and nothing else, exactly like the Shared client: no credential of its own (the request-time seam its
 * caller hands it), no user id, no Public ref, no retry, no meaning. Every answer is decoded strictly; anything else is
 * no answer.
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';
import { PublicAuthoringApiClient } from './public-authoring-api';
import { PublicSemanticApiClient } from './public-semantic-api';

export interface PublicWorldApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

export type PublicEntryResult =
  | { readonly kind: 'ALLOW' }
  /** Not admitted now — one neutral answer that reveals nothing of the policy or why. */
  | { readonly kind: 'DENIED' }
  | { readonly kind: 'UNAVAILABLE' };

export type PublicDisplayMode = 'PSEUDONYM' | 'REAL_NAME';
/** `label` is what the Public World renders now: the CURRENT Public ID (no `@`) or the CURRENT Name. */
export interface PublicDisplay { readonly mode: PublicDisplayMode; readonly label: string | null; readonly realNameAvailable: boolean }
export type PublicDisplayResult = { readonly kind: 'READ'; readonly display: PublicDisplay } | { readonly kind: 'UNAVAILABLE' };
export type PublicSetDisplayResult =
  | { readonly kind: 'UPDATED' | 'UNCHANGED' | 'NOT_AVAILABLE'; readonly mode: PublicDisplayMode; readonly label: string | null }
  | { readonly kind: 'UNAVAILABLE' };

type Exchange = { readonly kind: 'OK'; readonly body: unknown } | { readonly kind: 'STATUS'; readonly status: number } | { readonly kind: 'NETWORK' };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};
const isMode = (value: unknown): value is PublicDisplayMode => value === 'PSEUDONYM' || value === 'REAL_NAME';
const labelOf = (value: unknown): string | null | undefined => (value === null ? null : typeof value === 'string' && value.length > 0 ? value : undefined);

export class PublicWorldApiClient {
  /** S5-02 — the Public authoring routes, on the same identity-bound transport. */
  readonly authoring: PublicAuthoringApiClient;
  /** S5-03A — the semantic review routes, on the same identity-bound transport. */
  readonly semantic: PublicSemanticApiClient;

  constructor(private readonly config: PublicWorldApiConfig) {
    this.authoring = new PublicAuthoringApiClient(config);
    this.semantic = new PublicSemanticApiClient(config);
  }

  async entry(): Promise<PublicEntryResult> {
    const answer = await this.exchange('GET', '/public/entry');
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['outcome'])) return { kind: 'UNAVAILABLE' };
    if (answer.body.outcome === 'ALLOW') return { kind: 'ALLOW' };
    return answer.body.outcome === 'UNAVAILABLE' ? { kind: 'DENIED' } : { kind: 'UNAVAILABLE' };
  }

  async readDisplay(): Promise<PublicDisplayResult> {
    const answer = await this.exchange('GET', '/public/display');
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['mode', 'label', 'realNameAvailable'])) return { kind: 'UNAVAILABLE' };
    const { mode, realNameAvailable } = answer.body;
    const label = labelOf(answer.body.label);
    if (!isMode(mode) || typeof realNameAvailable !== 'boolean' || label === undefined) return { kind: 'UNAVAILABLE' };
    return { kind: 'READ', display: { mode, label, realNameAvailable } };
  }

  async setDisplay(mode: PublicDisplayMode): Promise<PublicSetDisplayResult> {
    const answer = await this.exchange('PUT', '/public/display', { mode });
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['outcome', 'mode', 'label'])) return { kind: 'UNAVAILABLE' };
    const { outcome } = answer.body;
    const label = labelOf(answer.body.label);
    if (!isMode(answer.body.mode) || label === undefined) return { kind: 'UNAVAILABLE' };
    const kind = outcome === 'UPDATED' || outcome === 'UNCHANGED' ? outcome : outcome === 'UNAVAILABLE' ? 'NOT_AVAILABLE' : null;
    return kind === null ? { kind: 'UNAVAILABLE' } : { kind, mode: answer.body.mode, label };
  }

  private async exchange(method: 'GET' | 'PUT', path: string, payload?: unknown): Promise<Exchange> {
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
