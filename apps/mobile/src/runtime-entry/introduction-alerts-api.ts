/**
 * S6-07 (CP3) — the client for the reader's per-Introduction alerts (migration 0167), beside the global Introductions
 * alerts control that Activity already owns:
 *
 *   GET /introductions/alerts                    — { worlds: [{ worldId, state, otherFirstName, muted }] }
 *   PUT /introductions/worlds/:worldId/alerts    { muted } — MUTED | UNMUTED | UNAVAILABLE
 *
 * A transport and nothing else: no credential of its own (the AC-01 request-time seam its caller hands it), no user id,
 * no state, no retry, no persistence. It decodes STRICTLY: an extra field or an unknown state makes the answer unusable.
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

export interface IntroductionAlertsApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

/** One of the reader's own Introduction Worlds, with its own mute. */
export interface IntroductionWorldAlert {
  readonly worldId: string;
  readonly state: 'ACTIVE' | 'ENDED';
  /** The first name the server presented to this reader, or null (IW-11b «تعارف» covers it). */
  readonly otherFirstName: string | null;
  readonly muted: boolean;
}
export type IntroductionAlertsResult = { readonly kind: 'READ'; readonly worlds: readonly IntroductionWorldAlert[] } | { readonly kind: 'UNAVAILABLE' };
/** NOT_A_WORLD: not one of the reader's Introduction Worlds now (one neutral answer). */
export type IntroductionSetAlertsResult = { readonly kind: 'MUTED' | 'UNMUTED' | 'NOT_A_WORLD' | 'UNAVAILABLE' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};

/** One row, or `null` when anything is doubtful. */
export function decodeIntroductionWorldAlert(value: unknown): IntroductionWorldAlert | null {
  if (!isRecord(value) || !hasExactly(value, ['worldId', 'state', 'otherFirstName', 'muted'])) return null;
  const { worldId, state, otherFirstName, muted } = value;
  if (typeof worldId !== 'string' || !UUID.test(worldId) || (state !== 'ACTIVE' && state !== 'ENDED') || typeof muted !== 'boolean') return null;
  if (otherFirstName !== null && (typeof otherFirstName !== 'string' || otherFirstName.trim().length === 0)) return null;
  return Object.freeze({ worldId: worldId.toLowerCase(), state, otherFirstName: otherFirstName as string | null, muted });
}

export class IntroductionAlertsApiClient {
  constructor(private readonly config: IntroductionAlertsApiConfig) {}

  async alerts(): Promise<IntroductionAlertsResult> {
    const answer = await this.exchange('GET', '/introductions/alerts');
    if (answer === null || !isRecord(answer) || !hasExactly(answer, ['worlds']) || !Array.isArray(answer.worlds)) return { kind: 'UNAVAILABLE' };
    const worlds = answer.worlds.map(decodeIntroductionWorldAlert);
    if (worlds.some((w) => w === null) || new Set(worlds.map((w) => w!.worldId)).size !== worlds.length) return { kind: 'UNAVAILABLE' };
    return { kind: 'READ', worlds: Object.freeze(worlds as IntroductionWorldAlert[]) };
  }

  async setAlerts(worldId: string, muted: boolean): Promise<IntroductionSetAlertsResult> {
    const answer = await this.exchange('PUT', `/introductions/worlds/${encodeURIComponent(worldId)}/alerts`, { muted });
    const outcome = isRecord(answer) && hasExactly(answer, ['outcome']) ? answer.outcome : null;
    if (outcome === 'MUTED' || outcome === 'UNMUTED') return { kind: outcome };
    return { kind: outcome === 'UNAVAILABLE' ? 'NOT_A_WORLD' : 'UNAVAILABLE' };
  }

  /** The decoded JSON of a 2xx, or null for any other answer. Never thrown. */
  private async exchange(method: 'GET' | 'PUT', path: string, payload?: unknown): Promise<unknown> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      if (!response.ok) return null;
      return (await response.json()) as unknown;
    } catch {
      return null;
    }
  }
}
