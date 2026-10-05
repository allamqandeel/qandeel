import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** Exactly the migration 0138 result shapes. bytea travels as PostgREST's `\x…` hex text. */
export interface SharedCapabilitiesRow { readonly invitation_available: boolean; readonly birth_available: boolean }
export interface SharedIdRow {
  readonly state: 'ABSENT' | 'SEALED' | 'UNSEALED';
  readonly credential_epoch: string | number | null;
  readonly credential_lookup_ref: string | null;
  readonly key_version: number | null;
  readonly nonce: string | null;
  readonly ciphertext: string | null;
  readonly auth_tag: string | null;
  readonly provisioning_available: boolean;
}
export interface SharedIdRotationRow { readonly outcome: 'ROTATED' | 'UNAVAILABLE'; readonly credential_epoch: string | number | null }
export interface SharedWorldRow { readonly world_id: string; readonly born_at: string; readonly joined_at: string }
export interface SharedWorldMemberRow { readonly world_id: string; readonly is_self: boolean; readonly member_name: string | null; readonly joined_at: string }
export interface SharedInvitationRow { readonly invitation_id: string; readonly inviter_name: string | null; readonly created_at: string }
export interface SharedEntryRow { readonly outcome: 'ALLOW' | 'UNAVAILABLE'; readonly world_id: string | null; readonly born_at: string | null; readonly joined_at: string | null }
export interface SharedOutcomeRow { readonly outcome: string }
export interface SharedAcceptanceRow { readonly outcome: 'BORN' | 'UNAVAILABLE' | 'NOT_ACCEPTABLE'; readonly world_id: string | null }

export const toBytea = (value: Buffer): string => `\\x${value.toString('hex')}`;
export function fromBytea(value: unknown): Buffer | null {
  return typeof value === 'string' && /^\\x(?:[0-9a-f]{2})*$/iu.test(value) ? Buffer.from(value.slice(2), 'hex') : null;
}

/**
 * S4-01 — the Shared World Product boundary's only transport. Every call runs on the caller's own token, so the
 * database's `auth.uid()` is the human; no account, inviter, target or World authority is ever sent. The server channel
 * is never used: migration 0138 grants it nothing.
 */
@Injectable()
export class SharedWorldRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private async rpc<T>(token: string, name: string, body: Record<string, unknown> = {}): Promise<T[]> {
    const rows = await this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
    return Array.isArray(rows) ? rows : [];
  }

  capabilities(token: string) { return this.rpc<SharedCapabilitiesRow>(token, 'read_shared_capabilities_v1'); }
  readSharedId(token: string) { return this.rpc<SharedIdRow>(token, 'read_own_shared_id_v1'); }

  rotateSharedId(token: string, commandId: string, expectedEpoch: string | null, sharedId: string, sealed: { keyVersion: number; nonce: Buffer; ciphertext: Buffer; tag: Buffer }) {
    return this.rpc<SharedIdRotationRow>(token, 'rotate_own_sealed_shared_id_v1', {
      p_command_id: commandId, p_expected_epoch: expectedEpoch, p_shared_id: sharedId, p_key_version: sealed.keyVersion,
      p_nonce: toBytea(sealed.nonce), p_ciphertext: toBytea(sealed.ciphertext), p_auth_tag: toBytea(sealed.tag),
    });
  }

  listWorlds(token: string) { return this.rpc<SharedWorldRow>(token, 'list_own_shared_worlds_v1'); }
  listMembers(token: string) { return this.rpc<SharedWorldMemberRow>(token, 'list_own_shared_world_members_v1'); }
  listInvitations(token: string) { return this.rpc<SharedInvitationRow>(token, 'list_own_shared_world_invitations_v1'); }

  submitInvitation(token: string, commandId: string, sharedId: string) {
    return this.rpc<SharedOutcomeRow>(token, 'submit_shared_world_invitation_v1', { p_command_id: commandId, p_shared_id: sharedId });
  }
  decline(token: string, commandId: string, invitationId: string) {
    return this.rpc<SharedOutcomeRow>(token, 'decline_shared_world_invitation_v1', { p_command_id: commandId, p_invitation_id: invitationId });
  }
  accept(token: string, commandId: string, invitationId: string) {
    return this.rpc<SharedAcceptanceRow>(token, 'accept_shared_world_invitation_v1', { p_command_id: commandId, p_invitation_id: invitationId });
  }
  resolveEntry(token: string, worldId: string) {
    return this.rpc<SharedEntryRow>(token, 'resolve_own_shared_world_entry_v1', { p_world_id: worldId });
  }
}
