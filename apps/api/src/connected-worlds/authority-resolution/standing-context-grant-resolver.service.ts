// I-03B - Shared Standing Context Grant resolution boundary.
//
// The ONE server-internal read path from the sealed I-02B Standing Context
// Grant persistence into the frozen I-03A `StandingContextGrantResolution`
// type. It answers, for an exact Shared World and an exact human grantor,
// what the currently ACTIVE grant and its explicit audience ceiling are - by
// calling exactly one narrow service-role PostgreSQL RPC (migration 0077),
// never a table. It follows the repository's server-only service-role
// transport precedent: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY server-side,
// no user access token, no client JWT, bounded timeout, sanitized failures.
//
// It resolves authority STATE only. Whether that state is sufficient for a
// request and audience is decided by `evaluateStandingContextAuthority`
// (I-03A), which this result feeds without translation. It creates, revokes
// or extends nothing, reads no private context, no membership and no
// consent event, invokes no model and exposes no route.
//
// Resolution meaning (task I-03B §3):
//   FOUND      - the lookup positively resolved exactly one current ACTIVE grant
//                and its complete explicit ceiling;
//   NOT_FOUND  - the lookup completed and positively established that no
//                ACTIVE grant exists for this exact (World, grantor);
//   UNRESOLVED - the current canonical state could not be established safely:
//                malformed input, missing server configuration, timeout,
//                transport failure, a noncanonical World or human (a bounded
//                database error), or a malformed / contradictory payload.
// Infrastructure failure and malformed rows never become NOT_FOUND.
//
// `authoritySnapshotRef` is a deterministic, versioned SHA-256 content
// fingerprint of the resolved facts (`sha256:<64 hex>`): same facts, same
// fingerprint; audience order irrelevant; any audience or grant change
// changes it; FOUND and NOT_FOUND never collide. No clock, no random
// identity, no secret, no persistence - evidence, not a bearer token.

import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isHumanPrincipal } from '../kernel/world-invariants';
import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import type {
  StandingContextGrantResolution,
  StandingContextGrantSnapshot,
  StandingContextResolutionFailure,
} from '../authority/standing-context-authority.types';

export const STANDING_CONTEXT_GRANT_RESOLUTION_RPC = 'resolve_shared_world_standing_context_grant_v1' as const;
export const STANDING_CONTEXT_AUTHORITY_SNAPSHOT_VERSION = 'QANDEEL_CWV2_STANDING_CONTEXT_AUTHORITY_SNAPSHOT_V1' as const;

// The canonical UUID shape (RFC 4122 variants only), used to fail closed on a
// malformed identity before it can reach the service-role transport.
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RESOLUTION_ROW_KEYS = ['grant_id', 'world_id', 'grantor_user_id', 'status', 'audience_user_id'] as const;
const REQUEST_TIMEOUT_MS = 5000;

/** One transport row of the migration-0077 resolver, as untrusted JSON. */
interface ResolutionRow {
  readonly grant_id: string;
  readonly world_id: string;
  readonly grantor_user_id: string;
  readonly status: 'ACTIVE';
  readonly audience_user_id: string | null;
}

function unresolved(failure: StandingContextResolutionFailure): StandingContextGrantResolution {
  return Object.freeze({ state: 'UNRESOLVED', failure } as const);
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_UUID.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Locale-independent code-unit ordering, so the same set always fingerprints
// and binds identically whatever order the transport delivered.
const byCodeUnit = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/**
 * The deterministic authority-state fingerprint (task I-03B §16). Exported so
 * tests can prove determinism and non-collision against the canonical content.
 */
export function fingerprintStandingContextAuthority(
  facts:
    | { readonly state: 'FOUND'; readonly worldId: string; readonly grantorId: string; readonly grantId: string; readonly audienceIds: ReadonlyArray<string> }
    | { readonly state: 'NOT_FOUND'; readonly worldId: string; readonly grantorId: string },
): string {
  const lines = [
    STANDING_CONTEXT_AUTHORITY_SNAPSHOT_VERSION,
    `state=${facts.state}`,
    `world=${facts.worldId.toLowerCase()}`,
    `grantor=${facts.grantorId.toLowerCase()}`,
  ];
  if (facts.state === 'FOUND') {
    lines.push(`grant=${facts.grantId.toLowerCase()}`, 'status=ACTIVE', `audience=${[...facts.audienceIds].map((id) => id.toLowerCase()).sort(byCodeUnit).join(',')}`);
  }
  return `sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`;
}

/**
 * Validates the untrusted RPC payload into either an exact grant snapshot, an
 * explicit "no ACTIVE grant" answer, or a contradiction. Nothing is partially
 * salvaged: any disagreement, duplicate, mixed NULL / non-NULL audience, wrong
 * status, wrong World or wrong grantor is contradictory canonical state.
 */
function interpretRows(payload: unknown, worldId: SharedWorldId, grantorId: string): StandingContextGrantSnapshot | 'NO_ACTIVE_GRANT' | 'CONTRADICTORY' {
  if (!Array.isArray(payload)) return 'CONTRADICTORY';
  if (payload.length === 0) return 'NO_ACTIVE_GRANT';
  const rowsOut: ResolutionRow[] = [];
  for (const row of payload) {
    if (!isRecord(row)) return 'CONTRADICTORY';
    const keys = Object.keys(row);
    if (keys.length !== RESOLUTION_ROW_KEYS.length || !RESOLUTION_ROW_KEYS.every((key) => keys.includes(key))) return 'CONTRADICTORY';
    if (!isCanonicalUuid(row.grant_id) || !isCanonicalUuid(row.world_id) || !isCanonicalUuid(row.grantor_user_id)) return 'CONTRADICTORY';
    if (row.status !== 'ACTIVE') return 'CONTRADICTORY';
    if (row.audience_user_id !== null && !isCanonicalUuid(row.audience_user_id)) return 'CONTRADICTORY';
    rowsOut.push({ grant_id: row.grant_id, world_id: row.world_id, grantor_user_id: row.grantor_user_id, status: 'ACTIVE', audience_user_id: row.audience_user_id });
  }
  const [head] = rowsOut;
  const grantId = head.grant_id.toLowerCase();
  if (head.world_id.toLowerCase() !== worldId.toLowerCase() || head.grantor_user_id.toLowerCase() !== grantorId.toLowerCase()) return 'CONTRADICTORY';
  if (!rowsOut.every((row) => row.grant_id.toLowerCase() === grantId && row.world_id.toLowerCase() === head.world_id.toLowerCase() && row.grantor_user_id.toLowerCase() === head.grantor_user_id.toLowerCase())) {
    return 'CONTRADICTORY';
  }
  const nullRows = rowsOut.filter((row) => row.audience_user_id === null).length;
  let audienceIds: string[];
  if (nullRows === rowsOut.length && rowsOut.length === 1) {
    audienceIds = [];
  } else if (nullRows === 0) {
    audienceIds = rowsOut.map((row) => (row.audience_user_id as string).toLowerCase());
    if (new Set(audienceIds).size !== audienceIds.length) return 'CONTRADICTORY';
  } else {
    return 'CONTRADICTORY';
  }
  const audienceCeiling: HumanPrincipal[] = [...audienceIds].sort(byCodeUnit).map((humanId) => Object.freeze({ kind: 'HUMAN', humanId } as const));
  return Object.freeze({
    grantId,
    // The requested (already-branded) identity passes through unchanged after
    // the equality check above; no new SharedWorldId is minted here.
    worldId,
    grantor: Object.freeze({ kind: 'HUMAN', humanId: head.grantor_user_id.toLowerCase() } as const),
    status: 'ACTIVE' as const,
    audienceCeiling: Object.freeze(audienceCeiling),
  });
}

@Injectable()
export class StandingContextGrantResolverService {
  /**
   * Resolves the current Standing Context Grant state for one exact Shared
   * World and one exact human grantor. Returns - never throws - a frozen
   * I-03A `StandingContextGrantResolution`. The result contains no secret
   * and no raw upstream error body.
   */
  async resolveCurrent(worldId: SharedWorldId, grantor: HumanPrincipal): Promise<StandingContextGrantResolution> {
    if (!isHumanPrincipal(grantor) || !isCanonicalUuid(grantor.humanId) || !isCanonicalUuid(worldId)) {
      return unresolved('CONTRADICTORY_CANONICAL_STATE');
    }
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceRoleKey) return unresolved('AUTHORITY_SNAPSHOT_UNAVAILABLE');

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/rest/v1/rpc/${STANDING_CONTEXT_GRANT_RESOLUTION_RPC}`, {
        method: 'POST',
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_world_id: worldId, p_grantor_user_id: grantor.humanId }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      return unresolved(isTimeout(error) ? 'LOOKUP_TIMED_OUT' : 'LOOKUP_FAILED');
    }
    // A noncanonical World or human is a bounded database error (non-2xx):
    // not safely knowable, never "no grant".
    if (!response.ok) return unresolved('LOOKUP_FAILED');
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return unresolved('LOOKUP_FAILED');
    }

    const interpreted = interpretRows(payload, worldId, grantor.humanId);
    if (interpreted === 'CONTRADICTORY') return unresolved('CONTRADICTORY_CANONICAL_STATE');
    if (interpreted === 'NO_ACTIVE_GRANT') {
      return Object.freeze({
        state: 'NOT_FOUND',
        authoritySnapshotRef: fingerprintStandingContextAuthority({ state: 'NOT_FOUND', worldId, grantorId: grantor.humanId }),
      } as const);
    }
    return Object.freeze({
      state: 'FOUND',
      authoritySnapshotRef: fingerprintStandingContextAuthority({
        state: 'FOUND',
        worldId,
        grantorId: grantor.humanId,
        grantId: interpreted.grantId,
        audienceIds: interpreted.audienceCeiling.map((human) => human.humanId),
      }),
      grant: interpreted,
    } as const);
  }
}

// AbortSignal.timeout rejects fetch with a DOMException named TimeoutError.
function isTimeout(error: unknown): boolean {
  return isRecord(error) && error.name === 'TimeoutError';
}
