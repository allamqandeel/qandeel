import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError, readDataApiUpstreamIdentity } from '../conversation/supabase-data-api.service';
import { drawSharedId, SharedIdSealing, SharedIdSealingUnavailable } from './shared-id-sealing';
import { SharedWorldLifecycleRepository } from './shared-world-lifecycle.repository';
import { fromBytea, SharedWorldRepository, type SharedIdRow, type SharedWorldMemberRow } from './shared-world.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const REF_DRAWS = 5;

export interface SharedMemberView { readonly name: string | null; readonly self: boolean }
/** S4-03: `name` is the World's committed name (the label once committed); null keeps the S4-01 member-name label. */
export interface SharedWorldView { readonly worldId: string; readonly name: string | null; readonly members: readonly SharedMemberView[] }
export interface SharedRootView {
  readonly capabilities: { readonly invitation: boolean; readonly birth: boolean };
  readonly worlds: readonly SharedWorldView[];
  readonly invitations: readonly { readonly invitationId: string; readonly inviterName: string | null }[];
  /** S4-03: the ended Worlds the reader holds a closed-view entitlement for (the members at closure). Never current Worlds. */
  readonly closedWorlds: readonly SharedWorldView[];
  /** S4-03: the add / rejoin requests waiting on the reader as their exact target — who proposed it, and nothing of the World. */
  readonly memberRequests: readonly { readonly requestId: string; readonly worldId: string; readonly kind: 'ADD' | 'REJOIN'; readonly proposerName: string | null }[];
}
export type SharedIdentityView = { readonly status: 'READY'; readonly sharedId: string } | { readonly status: 'UNAVAILABLE' };
export type SharedInvitationView = { readonly outcome: 'SUBMITTED' | 'INVALID_SHARED_ID' | 'UNAVAILABLE' };
export type SharedAcceptView = { readonly outcome: 'BORN'; readonly worldId: string } | { readonly outcome: 'UNAVAILABLE' | 'NOT_ACCEPTABLE' };
export type SharedDeclineView = { readonly outcome: 'DECLINED' | 'NOT_DECLINABLE' };
export type SharedEntryView =
  | { readonly outcome: 'ALLOW'; readonly world: { readonly worldId: string; readonly bornAt: string; readonly name: string | null; readonly members: readonly SharedMemberView[] } }
  | { readonly outcome: 'UNAVAILABLE' };

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Shared World is unavailable.'); };
function commandOf(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  const value = record(body);
  if (Object.keys(value).some((key) => !allowed.includes(key)) || typeof value.commandId !== 'string' || !UUID.test(value.commandId)) invalid();
  return value;
}
const databaseCode = (error: unknown): string | undefined => (error instanceof DataApiError ? readDataApiUpstreamIdentity(error).databaseCode : undefined);
const databaseMessage = (error: unknown): string | undefined => (error instanceof DataApiError ? readDataApiUpstreamIdentity(error).databaseMessage : undefined);
const members = (rows: readonly SharedWorldMemberRow[], worldId: string): SharedMemberView[] =>
  rows.filter((m) => m.world_id === worldId).map((m) => ({ name: m.member_name, self: m.is_self === true }));

/**
 * S4-01 — the Shared World Product boundary over migration 0138. Identity is the verified token only; no route takes a
 * user id, an inviter, a target or a World authority. Every answer is Product-safe: the invitation names nobody, an
 * entry refusal is one neutral UNAVAILABLE, and the Shared ID is shown only to its owner, after its sealed value is
 * proved to be the CURRENT one.
 */
@Injectable()
export class SharedWorldService {
  constructor(
    private readonly repository: SharedWorldRepository,
    private readonly sealing: SharedIdSealing,
    private readonly lifecycle: SharedWorldLifecycleRepository,
  ) {}

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }

  root(token: string): Promise<SharedRootView> {
    return this.guard(async () => {
      const [[capabilities], worlds, memberRows, invitations, nameRows, closed, closedPeople, requests] = await Promise.all([
        this.repository.capabilities(token), this.repository.listWorlds(token), this.repository.listMembers(token),
        this.repository.listInvitations(token), this.lifecycle.worldNames(token), this.lifecycle.closedWorlds(token),
        this.lifecycle.closedMembers(token), this.lifecycle.membershipRequests(token),
      ]);
      if (capabilities === undefined) return unavailable();
      if (requests.some((r) => !UUID.test(r.request_id) || !UUID.test(r.world_id) || (r.request_kind !== 'ADD_MEMBER' && r.request_kind !== 'REJOIN_MEMBER'))) {
        return unavailable();
      }
      const nameOf = (worldId: string) => nameRows.find((n) => n.world_id === worldId)?.world_name ?? null;
      return {
        capabilities: { invitation: capabilities.invitation_available === true, birth: capabilities.birth_available === true },
        worlds: worlds.map((w) => ({ worldId: w.world_id, name: nameOf(w.world_id), members: members(memberRows, w.world_id) })),
        invitations: invitations.map((i) => ({ invitationId: i.invitation_id, inviterName: i.inviter_name })),
        closedWorlds: closed.map((w) => ({
          worldId: w.world_id, name: w.world_name,
          members: closedPeople.filter((m) => m.world_id === w.world_id).map((m) => ({ name: m.member_name, self: m.is_self === true })),
        })),
        memberRequests: requests.map((r) => ({
          requestId: r.request_id, worldId: r.world_id, kind: r.request_kind === 'ADD_MEMBER' ? 'ADD' as const : 'REJOIN' as const,
          proposerName: r.proposer_name,
        })),
      };
    });
  }

  /** The owner's current Shared ID, provisioned automatically on first read while Shared is open. */
  identity(userId: string, token: string): Promise<SharedIdentityView> {
    return this.guard(async () => {
      if (!this.sealing.available) return unavailable();
      const row = await this.readOwn(token);
      if (row.state === 'SEALED') return this.opened(userId, row);
      if (row.state === 'ABSENT') {
        if (!row.provisioning_available) return { status: 'UNAVAILABLE' };
        return this.rotate(userId, token, randomUUID(), null);
      }
      // A credential with no matching sealed value (rotated outside the sealed path before S4-01): nobody can hold its
      // value, so a fresh sealed one replaces it.
      return this.rotate(userId, token, randomUUID(), String(row.credential_epoch));
    });
  }

  /** Regeneration: the old value and every PENDING invitation of its epoch stop working; born Worlds are untouched. */
  async regenerate(userId: string, token: string, body: unknown): Promise<SharedIdentityView> {
    const { commandId } = commandOf(body, ['commandId']);
    return this.guard(async () => {
      if (!this.sealing.available) return unavailable();
      const row = await this.readOwn(token);
      if (row.state === 'ABSENT') return row.provisioning_available ? this.rotate(userId, token, commandId as string, null) : { status: 'UNAVAILABLE' };
      return this.rotate(userId, token, commandId as string, String(row.credential_epoch));
    });
  }

  async invite(token: string, body: unknown): Promise<SharedInvitationView> {
    const value = commandOf(body, ['commandId', 'sharedId']);
    if (typeof value.sharedId !== 'string' || value.sharedId.length > 64) invalid();
    return this.guard(async () => {
      const [row] = await this.repository.submitInvitation(token, value.commandId as string, value.sharedId as string);
      if (row?.outcome === 'SUBMITTED' || row?.outcome === 'INVALID_SHARED_ID' || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  async accept(token: string, invitationId: string, body: unknown): Promise<SharedAcceptView> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!UUID.test(invitationId)) return Promise.resolve({ outcome: 'NOT_ACCEPTABLE' });
    return this.guard(async () => {
      const [row] = await this.repository.accept(token, commandId as string, invitationId);
      if (row?.outcome === 'BORN' && typeof row.world_id === 'string' && UUID.test(row.world_id)) return { outcome: 'BORN', worldId: row.world_id };
      if (row?.outcome === 'UNAVAILABLE' || row?.outcome === 'NOT_ACCEPTABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  async decline(token: string, invitationId: string, body: unknown): Promise<SharedDeclineView> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!UUID.test(invitationId)) return Promise.resolve({ outcome: 'NOT_DECLINABLE' });
    return this.guard(async () => {
      const [row] = await this.repository.decline(token, commandId as string, invitationId);
      if (row?.outcome === 'DECLINED' || row?.outcome === 'NOT_DECLINABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  /** The authority verdict for one World, resolved before any of its content is returned (CW2-07 §19, §43). */
  entry(token: string, worldId: string): Promise<SharedEntryView> {
    if (!UUID.test(worldId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      const [verdict] = await this.repository.resolveEntry(token, worldId);
      if (verdict?.outcome !== 'ALLOW' || verdict.world_id !== worldId || typeof verdict.born_at !== 'string') return { outcome: 'UNAVAILABLE' };
      const [memberRows, nameRows] = await Promise.all([this.repository.listMembers(token), this.lifecycle.worldNames(token)]);
      const current = members(memberRows, worldId);
      if (current.length === 0) return { outcome: 'UNAVAILABLE' };
      const name = nameRows.find((n) => n.world_id === worldId)?.world_name ?? null;
      return { outcome: 'ALLOW', world: { worldId, bornAt: verdict.born_at, name, members: current } };
    });
  }

  private async readOwn(token: string): Promise<SharedIdRow> {
    const [row] = await this.repository.readSharedId(token);
    if (row === undefined || !['ABSENT', 'SEALED', 'UNSEALED'].includes(row.state)) return unavailable();
    return row;
  }

  private opened(userId: string, row: SharedIdRow): SharedIdentityView {
    const nonce = fromBytea(row.nonce);
    const ciphertext = fromBytea(row.ciphertext);
    const tag = fromBytea(row.auth_tag);
    if (nonce === null || ciphertext === null || tag === null || typeof row.key_version !== 'number' || typeof row.credential_lookup_ref !== 'string'
      || row.credential_epoch === null) return unavailable();
    const value = this.sealing.open(userId, String(row.credential_epoch), row.credential_lookup_ref, { keyVersion: row.key_version, nonce, ciphertext, tag });
    // A value that cannot be proved current is never shown, and never silently replaced: fail closed.
    return value === null ? unavailable() : { status: 'READY', sharedId: value };
  }

  /** One sealed rotation; a held value is drawn again under the same command, then the current value is read back. */
  private async rotate(userId: string, token: string, commandId: string, expectedEpoch: string | null): Promise<SharedIdentityView> {
    const nextEpoch = String(expectedEpoch === null ? 1 : Number(expectedEpoch) + 1);
    for (let draw = 1; draw <= REF_DRAWS; draw += 1) {
      const value = drawSharedId();
      try {
        const [row] = await this.repository.rotateSharedId(token, commandId, expectedEpoch, value, this.sealing.seal(userId, nextEpoch, value));
        if (row?.outcome === 'UNAVAILABLE') return { status: 'UNAVAILABLE' };
        if (row?.outcome !== 'ROTATED') return unavailable();
        break;
      } catch (error) {
        if (error instanceof SharedIdSealingUnavailable) return unavailable();
        if (databaseCode(error) === '23505' && databaseMessage(error) === 'SHARED_INVITE_CREDENTIAL_REF_UNAVAILABLE' && draw < REF_DRAWS) continue;
        // Another request rotated first: its value is the current one.
        if (databaseCode(error) === '40001') break;
        throw error;
      }
    }
    const current = await this.readOwn(token);
    return current.state === 'SEALED' ? this.opened(userId, current) : unavailable();
  }
}
