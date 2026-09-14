// I-03D - Shared human audience snapshot resolution boundary.
//
// The ONE server-internal read path from the sealed I-02A Shared membership
// persistence into the frozen I-03A `SharedHumanAudienceSnapshot`. It answers,
// for an exact Shared World, which humans currently hold an OPEN membership
// episode there - by calling exactly one narrow service-role PostgreSQL RPC
// (migration 0079), never a table. It follows the repository's server-only
// service-role transport precedent: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// server-side, no user access token, no client JWT, bounded timeout,
// sanitized failures. The I-03B resolver is a sibling precedent, not a shared
// helper: nothing is imported from it and nothing there is changed.
//
// It resolves audience STATE only (CW2-02 §21, "Resolve exact Audience
// Snapshot"). The authoritative source is persisted current membership -
// never a client-supplied list, an open screen, cached app state, recent
// senders or a Standing Context grant ceiling (CW2-02 §44). Current membership
// is not historical-material access (CW2-02 B21), lifecycle is not consulted
// (a READ_ONLY_CLOSED World resolves as persisted; generation permission is a
// later boundary), and nothing here invokes I-03A, I-03B, a model, or assembles
// an EffectiveContext.
//
// Resolution meaning (task I-03D §18):
//   RESOLVED   - one or more current humans, as the frozen I-03A snapshot;
//   EMPTY      - the canonical World exists and has zero open episodes;
//   UNRESOLVED - the current audience could not be safely established.
// Infrastructure failure, a noncanonical World and malformed rows never become
// EMPTY; EMPTY never becomes a failure.
//
// `snapshotRef` is a deterministic, versioned SHA-256 content fingerprint
// (`sha256:<64 hex>`) that binds the World and, for every current human, BOTH
// the user id and the current membership episode id - so a leave followed by
// a rejoin changes the snapshot even when the human set is identical again
// (task I-03D §12, §24; CW2-02 §48 / B34). Row order is irrelevant; RESOLVED
// and EMPTY are domain-separated; no clock, no random identity, no secret, no
// persistence - evidence for later revalidation, never a bearer permission.

import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import type { SharedHumanAudienceSnapshot } from '../authority/standing-context-authority.types';
import type { SharedHumanAudienceResolution, SharedHumanAudienceResolutionFailure } from './shared-human-audience-resolution.types';

export const SHARED_HUMAN_AUDIENCE_RESOLUTION_RPC = 'resolve_shared_world_human_audience_snapshot_v1' as const;
export const SHARED_HUMAN_AUDIENCE_SNAPSHOT_VERSION = 'QANDEEL_CWV2_SHARED_HUMAN_AUDIENCE_SNAPSHOT_V1' as const;

// The canonical UUID shape (RFC 4122 variants only), used to fail closed on a
// malformed identity before it can reach the service-role transport.
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const AUDIENCE_ROW_KEYS = ['world_id', 'membership_episode_id', 'user_id'] as const;
const REQUEST_TIMEOUT_MS = 5000;

/** One current membership fact: a human and the exact open episode under which they are present. */
export interface CurrentMembership {
  readonly userId: string;
  readonly membershipEpisodeId: string;
}

function unresolved(failure: SharedHumanAudienceResolutionFailure): SharedHumanAudienceResolution {
  return Object.freeze({ state: 'UNRESOLVED', failure } as const);
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_UUID.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Locale-independent code-unit ordering, so the same membership state always
// fingerprints identically whatever order the transport delivered.
const byCodeUnit = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const byUserThenEpisode = (left: CurrentMembership, right: CurrentMembership): number =>
  byCodeUnit(left.userId, right.userId) || byCodeUnit(left.membershipEpisodeId, right.membershipEpisodeId);

/**
 * The deterministic audience-state fingerprint (task I-03D §24). Exported so
 * tests can prove determinism, order independence and non-collision against
 * the canonical content.
 */
export function fingerprintSharedHumanAudience(
  facts:
    | { readonly state: 'RESOLVED'; readonly worldId: string; readonly members: ReadonlyArray<CurrentMembership> }
    | { readonly state: 'EMPTY'; readonly worldId: string },
): string {
  const members = facts.state === 'RESOLVED'
    ? [...facts.members]
        .map((member) => ({ userId: member.userId.toLowerCase(), membershipEpisodeId: member.membershipEpisodeId.toLowerCase() }))
        .sort(byUserThenEpisode)
        .map((member) => `${member.userId}@${member.membershipEpisodeId}`)
        .join(',')
    : '';
  const lines = [SHARED_HUMAN_AUDIENCE_SNAPSHOT_VERSION, `state=${facts.state}`, `world=${facts.worldId.toLowerCase()}`, `members=${members}`];
  return `sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`;
}

/**
 * Validates the untrusted RPC payload into either the exact current
 * membership facts, an explicit "zero open episodes" answer, or a
 * contradiction. Nothing is partially salvaged: any malformed row, unknown or
 * missing property, wrong World, duplicate human or duplicate episode is
 * contradictory canonical state.
 */
function interpretRows(payload: unknown, worldId: SharedWorldId): ReadonlyArray<CurrentMembership> | 'NO_CURRENT_MEMBERS' | 'CONTRADICTORY' {
  if (!Array.isArray(payload)) return 'CONTRADICTORY';
  if (payload.length === 0) return 'NO_CURRENT_MEMBERS';
  const members: CurrentMembership[] = [];
  const requestedWorld = worldId.toLowerCase();
  for (const row of payload) {
    if (!isRecord(row)) return 'CONTRADICTORY';
    const keys = Object.keys(row);
    if (keys.length !== AUDIENCE_ROW_KEYS.length || !AUDIENCE_ROW_KEYS.every((key) => keys.includes(key))) return 'CONTRADICTORY';
    if (!isCanonicalUuid(row.world_id) || !isCanonicalUuid(row.membership_episode_id) || !isCanonicalUuid(row.user_id)) return 'CONTRADICTORY';
    if (row.world_id.toLowerCase() !== requestedWorld) return 'CONTRADICTORY';
    members.push({ userId: row.user_id.toLowerCase(), membershipEpisodeId: row.membership_episode_id.toLowerCase() });
  }
  if (new Set(members.map((member) => member.userId)).size !== members.length) return 'CONTRADICTORY';
  if (new Set(members.map((member) => member.membershipEpisodeId)).size !== members.length) return 'CONTRADICTORY';
  return Object.freeze([...members].sort(byUserThenEpisode));
}

@Injectable()
export class SharedHumanAudienceResolverService {
  /**
   * Resolves the exact current human audience of one exact Shared World.
   * Returns - never throws - a frozen `SharedHumanAudienceResolution` whose
   * RESOLVED snapshot is the frozen I-03A `SharedHumanAudienceSnapshot`. The
   * result contains no secret and no raw upstream error body.
   */
  async resolveCurrent(worldId: SharedWorldId): Promise<SharedHumanAudienceResolution> {
    if (!isCanonicalUuid(worldId)) return unresolved('CONTRADICTORY_CANONICAL_STATE');
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceRoleKey) return unresolved('AUDIENCE_SNAPSHOT_UNAVAILABLE');

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/rest/v1/rpc/${SHARED_HUMAN_AUDIENCE_RESOLUTION_RPC}`, {
        method: 'POST',
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_world_id: worldId }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      return unresolved(isTimeout(error) ? 'LOOKUP_TIMED_OUT' : 'LOOKUP_FAILED');
    }
    // A noncanonical World is a bounded database error (non-2xx): not safely
    // knowable, never an empty audience.
    if (!response.ok) return unresolved('LOOKUP_FAILED');
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return unresolved('LOOKUP_FAILED');
    }

    const interpreted = interpretRows(payload, worldId);
    if (interpreted === 'CONTRADICTORY') return unresolved('CONTRADICTORY_CANONICAL_STATE');
    if (interpreted === 'NO_CURRENT_MEMBERS') {
      return Object.freeze({ state: 'EMPTY', snapshotRef: fingerprintSharedHumanAudience({ state: 'EMPTY', worldId }) } as const);
    }
    // Every current member is a human principal; QANDEEL, owners or grantors
    // are never inserted. Humans are canonically ordered by id.
    const humans: ReadonlyArray<HumanPrincipal> = Object.freeze(
      interpreted.map((member) => Object.freeze({ kind: 'HUMAN', humanId: member.userId } as const)),
    );
    const snapshot: SharedHumanAudienceSnapshot = Object.freeze({
      snapshotRef: fingerprintSharedHumanAudience({ state: 'RESOLVED', worldId, members: interpreted }),
      humans,
    });
    return Object.freeze({ state: 'RESOLVED', snapshot } as const);
  }
}

// AbortSignal.timeout rejects fetch with a DOMException named TimeoutError.
function isTimeout(error: unknown): boolean {
  return isRecord(error) && error.name === 'TimeoutError';
}
