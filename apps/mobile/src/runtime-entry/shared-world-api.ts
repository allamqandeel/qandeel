/**
 * S4-01 — the client for the «العالم المشترك» / Shared World Product routes.
 *
 *   GET  /shared                                   — the root: current Worlds, incoming invitations, capability hints
 *   GET  /shared/identity                          — the reader's own Shared ID (provisioned by the server on first read)
 *   POST /shared/identity/regenerate               — { commandId }
 *   POST /shared/invitations                       — { commandId, sharedId } → one non-enumerating outcome
 *   POST /shared/invitations/:id/accept|decline    — { commandId }
 *   GET  /shared/worlds/:worldId                   — the entry verdict, then the World shell
 *
 * A transport and nothing else, exactly like the Activity client: no credential of its own (the request-time seam its
 * caller hands it), no user id, no retry, no meaning. Every answer is decoded strictly; anything else is no answer.
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHARED_ID = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/u;

export interface SharedMember { readonly name: string | null; readonly self: boolean }
export interface SharedWorldSummary { readonly worldId: string; readonly members: readonly SharedMember[] }
export interface SharedInvitation { readonly invitationId: string; readonly inviterName: string | null }
export interface SharedRoot {
  readonly capabilities: { readonly invitation: boolean; readonly birth: boolean };
  readonly worlds: readonly SharedWorldSummary[];
  readonly invitations: readonly SharedInvitation[];
}
export type SharedRootResult = { readonly kind: 'READ'; readonly root: SharedRoot } | { readonly kind: 'UNAVAILABLE' };
export type SharedIdentityResult =
  | { readonly kind: 'READY'; readonly sharedId: string }
  /** Shared is not open yet: no Shared ID exists and none is created. */
  | { readonly kind: 'NOT_OPEN' }
  | { readonly kind: 'UNAVAILABLE' };
export type SharedInviteResult = { readonly kind: 'SUBMITTED' | 'INVALID_SHARED_ID' | 'NOT_OPEN' | 'UNAVAILABLE' };
export type SharedAcceptResult =
  | { readonly kind: 'BORN'; readonly worldId: string }
  | { readonly kind: 'NOT_OPEN' | 'NOT_ACCEPTABLE' | 'UNAVAILABLE' };
export type SharedDeclineResult = { readonly kind: 'DECLINED' | 'NOT_DECLINABLE' | 'UNAVAILABLE' };
export interface SharedWorldShell { readonly worldId: string; readonly bornAt: string; readonly members: readonly SharedMember[] }
export type SharedEntryResult =
  | { readonly kind: 'ALLOW'; readonly world: SharedWorldShell }
  /** Denied, unknown, left or never existed — one neutral answer that reveals nothing. */
  | { readonly kind: 'DENIED' }
  | { readonly kind: 'UNAVAILABLE' };

export interface SharedWorldApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]) => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};
const nameOf = (value: unknown): string | null | undefined => (value === null ? null : typeof value === 'string' && value.length <= 200 ? value : undefined);

function decodeMembers(value: unknown): SharedMember[] | null {
  if (!Array.isArray(value)) return null;
  const out: SharedMember[] = [];
  for (const m of value) {
    if (!isRecord(m) || !hasExactly(m, ['name', 'self']) || typeof m.self !== 'boolean') return null;
    const name = nameOf(m.name);
    if (name === undefined) return null;
    out.push({ name, self: m.self });
  }
  return out;
}

export function decodeSharedRoot(body: unknown): SharedRoot | null {
  if (!isRecord(body) || !hasExactly(body, ['capabilities', 'worlds', 'invitations'])) return null;
  const c = body.capabilities;
  if (!isRecord(c) || !hasExactly(c, ['invitation', 'birth']) || typeof c.invitation !== 'boolean' || typeof c.birth !== 'boolean') return null;
  if (!Array.isArray(body.worlds) || !Array.isArray(body.invitations)) return null;
  const worlds: SharedWorldSummary[] = [];
  for (const w of body.worlds) {
    if (!isRecord(w) || !hasExactly(w, ['worldId', 'members']) || typeof w.worldId !== 'string' || !UUID.test(w.worldId)) return null;
    const members = decodeMembers(w.members);
    if (members === null) return null;
    worlds.push({ worldId: w.worldId, members });
  }
  const invitations: SharedInvitation[] = [];
  for (const i of body.invitations) {
    if (!isRecord(i) || !hasExactly(i, ['invitationId', 'inviterName']) || typeof i.invitationId !== 'string' || !UUID.test(i.invitationId)) return null;
    const inviterName = nameOf(i.inviterName);
    if (inviterName === undefined) return null;
    invitations.push({ invitationId: i.invitationId, inviterName });
  }
  return { capabilities: { invitation: c.invitation, birth: c.birth }, worlds, invitations };
}

type Exchange = { readonly kind: 'OK'; readonly body: unknown } | { readonly kind: 'STATUS'; readonly status: number } | { readonly kind: 'NETWORK' };

export class SharedWorldApiClient {
  constructor(private readonly config: SharedWorldApiConfig) {}

  async root(): Promise<SharedRootResult> {
    const answer = await this.exchange('GET', '/shared');
    const root = answer.kind === 'OK' ? decodeSharedRoot(answer.body) : null;
    return root === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', root };
  }

  identity(): Promise<SharedIdentityResult> {
    return this.identityAnswer(this.exchange('GET', '/shared/identity'));
  }

  regenerate(commandId: string): Promise<SharedIdentityResult> {
    return this.identityAnswer(this.exchange('POST', '/shared/identity/regenerate', { commandId }));
  }

  async invite(commandId: string, sharedId: string): Promise<SharedInviteResult> {
    const outcome = await this.outcome(this.exchange('POST', '/shared/invitations', { commandId, sharedId }));
    if (outcome === 'SUBMITTED' || outcome === 'INVALID_SHARED_ID') return { kind: outcome };
    return { kind: outcome === 'UNAVAILABLE' ? 'NOT_OPEN' : 'UNAVAILABLE' };
  }

  async accept(invitationId: string, commandId: string): Promise<SharedAcceptResult> {
    const answer = await this.exchange('POST', `/shared/invitations/${encodeURIComponent(invitationId)}/accept`, { commandId });
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return { kind: 'UNAVAILABLE' };
    const body = answer.body;
    if (body.outcome === 'BORN' && hasExactly(body, ['outcome', 'worldId']) && typeof body.worldId === 'string' && UUID.test(body.worldId)) {
      return { kind: 'BORN', worldId: body.worldId };
    }
    if (hasExactly(body, ['outcome']) && body.outcome === 'NOT_ACCEPTABLE') return { kind: 'NOT_ACCEPTABLE' };
    if (hasExactly(body, ['outcome']) && body.outcome === 'UNAVAILABLE') return { kind: 'NOT_OPEN' };
    return { kind: 'UNAVAILABLE' };
  }

  async decline(invitationId: string, commandId: string): Promise<SharedDeclineResult> {
    const outcome = await this.outcome(this.exchange('POST', `/shared/invitations/${encodeURIComponent(invitationId)}/decline`, { commandId }));
    return { kind: outcome === 'DECLINED' || outcome === 'NOT_DECLINABLE' ? outcome : 'UNAVAILABLE' };
  }

  async entry(worldId: string): Promise<SharedEntryResult> {
    const answer = await this.exchange('GET', `/shared/worlds/${encodeURIComponent(worldId)}`);
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return { kind: 'UNAVAILABLE' };
    const body = answer.body;
    if (hasExactly(body, ['outcome']) && body.outcome === 'UNAVAILABLE') return { kind: 'DENIED' };
    if (body.outcome !== 'ALLOW' || !hasExactly(body, ['outcome', 'world']) || !isRecord(body.world)) return { kind: 'UNAVAILABLE' };
    const w = body.world;
    if (!hasExactly(w, ['worldId', 'bornAt', 'members']) || w.worldId !== worldId || typeof w.bornAt !== 'string') return { kind: 'UNAVAILABLE' };
    const members = decodeMembers(w.members);
    return members === null ? { kind: 'UNAVAILABLE' } : { kind: 'ALLOW', world: { worldId, bornAt: w.bornAt, members } };
  }

  private async identityAnswer(pending: Promise<Exchange>): Promise<SharedIdentityResult> {
    const answer = await pending;
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return { kind: 'UNAVAILABLE' };
    const body = answer.body;
    if (body.status === 'READY' && hasExactly(body, ['status', 'sharedId']) && typeof body.sharedId === 'string' && SHARED_ID.test(body.sharedId)) {
      return { kind: 'READY', sharedId: body.sharedId };
    }
    if (body.status === 'UNAVAILABLE' && hasExactly(body, ['status'])) return { kind: 'NOT_OPEN' };
    return { kind: 'UNAVAILABLE' };
  }

  private async outcome(pending: Promise<Exchange>): Promise<string | null> {
    const answer = await pending;
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['outcome'])) return null;
    return typeof answer.body.outcome === 'string' ? answer.body.outcome : null;
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
