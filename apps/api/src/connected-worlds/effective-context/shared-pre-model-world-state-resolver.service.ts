// I-03E - Shared pre-model World-state resolution boundary.
//
// The ONE server-internal read path from the sealed I-02A Shared World row
// into the pre-model World gate. It answers, for an exact Shared World, its
// canonical lifecycle and phase - by calling exactly one narrow service-role
// PostgreSQL RPC (migration 0080), never a table. It follows the repository's
// server-only service-role transport precedent (I-03B, I-03D): SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY server-side, no user access token, no client JWT,
// bounded timeout, sanitized failures. The I-03B and I-03D resolvers are
// sibling precedents, not shared helpers: nothing is imported from them and
// nothing there is changed.
//
// It resolves World STATE only (CW2-02 §21, "Resolve World / capability").
// Lifecycle is never inferred from audience size, from a UI surface or from a
// client claim, and it is never decided here: whether READ_ONLY_CLOSED blocks
// an ordinary generation is the EffectiveContext service's gate. Nothing here
// invokes I-03A, I-03B, I-03D, a model, or assembles an EffectiveContext.
//
// Resolution meaning (task I-03E §8, §10):
//   RESOLVED   - exactly one canonical row with a kernel-legal lifecycle /
//                phase pair;
//   UNRESOLVED - the state could not be safely established. The 0080 resolver
//                raises the bounded SQLSTATE P0002 for a nonexistent canonical
//                World, and exactly that code is CONTRADICTORY_CANONICAL_STATE;
//                every other rejection - permission, missing function, 5xx,
//                any other code, a malformed or non-JSON error body - is
//                LOOKUP_FAILED. Only the bounded `code` of a rejection is
//                read; its message, details and body never enter a result.
// Zero rows, more than one row, a foreign World, an unknown property, an
// unknown lifecycle or phase: contradictory canonical state, never a default.
//
// `snapshotRef` is a deterministic, versioned SHA-256 content fingerprint
// (`sha256:<64 hex>`) over the World, its lifecycle and its phase, so any
// lifecycle or phase change changes the reference. No clock, no random
// identity, no secret, no persistence - evidence for later revalidation,
// never a bearer permission.

import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isLegalSharedWorldState } from '../kernel/world-invariants';
import type { SharedWorldId } from '../kernel/world.types';
import type { SharedWorldLifecycle, SharedWorldPhase, SharedWorldState } from '../kernel/shared-world.types';
import type {
  SharedPreModelWorldStateResolution,
  SharedPreModelWorldStateResolutionFailure,
  SharedPreModelWorldStateSnapshot,
} from './shared-effective-context.types';

export const SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC = 'resolve_shared_world_pre_model_state_v1' as const;
export const SHARED_PRE_MODEL_WORLD_STATE_SNAPSHOT_VERSION = 'QANDEEL_CWV2_SHARED_PRE_MODEL_WORLD_STATE_V1' as const;

// The canonical UUID shape (RFC 4122 variants only), used to fail closed on a
// malformed identity before it can reach the service-role transport.
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const WORLD_STATE_ROW_KEYS = ['world_id', 'lifecycle', 'phase'] as const;
const REQUEST_TIMEOUT_MS = 5000;
/** The bounded SQLSTATE migration 0080 raises for a nonexistent canonical Shared World (no_data_found). */
export const NONCANONICAL_WORLD_SQLSTATE = 'P0002' as const;

function unresolved(failure: SharedPreModelWorldStateResolutionFailure): SharedPreModelWorldStateResolution {
  return Object.freeze({ state: 'UNRESOLVED', failure } as const);
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_UUID.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Classifies a non-2xx rejection by its bounded database error code alone.
 * Exactly the 0080 nonexistent-World SQLSTATE is canonical contradiction;
 * everything else - a permission or configuration failure, a missing
 * function, a 5xx, any other code, a malformed or non-JSON error body - is
 * infrastructure failure. The body is read only to extract `code`; no
 * message, detail, hint or body text is retained.
 */
async function classifyRejection(response: Response): Promise<SharedPreModelWorldStateResolutionFailure> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return 'LOOKUP_FAILED';
  }
  return isRecord(body) && body.code === NONCANONICAL_WORLD_SQLSTATE ? 'CONTRADICTORY_CANONICAL_STATE' : 'LOOKUP_FAILED';
}

/**
 * The deterministic World-state fingerprint (task I-03E §11). Exported so
 * tests can prove determinism and non-collision against the canonical content.
 */
export function fingerprintSharedPreModelWorldState(facts: {
  readonly worldId: string;
  readonly lifecycle: SharedWorldLifecycle;
  readonly phase: SharedWorldPhase;
}): string {
  const lines = [SHARED_PRE_MODEL_WORLD_STATE_SNAPSHOT_VERSION, `world=${facts.worldId.toLowerCase()}`, `lifecycle=${facts.lifecycle}`, `phase=${facts.phase}`];
  return `sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`;
}

/**
 * Validates the untrusted RPC payload into exactly one kernel-legal World
 * state, or a contradiction. Nothing is partially salvaged: zero rows, more
 * than one row, an unknown or missing property, a foreign World, or a
 * lifecycle / phase outside the frozen kernel vocabulary is contradictory
 * canonical state.
 */
function interpretRows(payload: unknown, worldId: SharedWorldId): SharedWorldState | 'CONTRADICTORY' {
  if (!Array.isArray(payload) || payload.length !== 1) return 'CONTRADICTORY';
  const [row] = payload as ReadonlyArray<unknown>;
  if (!isRecord(row)) return 'CONTRADICTORY';
  const keys = Object.keys(row);
  if (keys.length !== WORLD_STATE_ROW_KEYS.length || !WORLD_STATE_ROW_KEYS.every((key) => keys.includes(key))) return 'CONTRADICTORY';
  if (!isCanonicalUuid(row.world_id) || row.world_id.toLowerCase() !== worldId.toLowerCase()) return 'CONTRADICTORY';
  const state: unknown = { lifecycle: row.lifecycle, phase: row.phase };
  if (typeof row.lifecycle !== 'string' || typeof row.phase !== 'string' || !isLegalSharedWorldState(state)) return 'CONTRADICTORY';
  return Object.freeze({ lifecycle: state.lifecycle, phase: state.phase });
}

@Injectable()
export class SharedPreModelWorldStateResolverService {
  /**
   * Resolves the exact canonical lifecycle / phase of one exact Shared World.
   * Returns - never throws - a frozen `SharedPreModelWorldStateResolution`.
   * The result contains no secret and no raw upstream error body.
   */
  async resolveCurrent(worldId: SharedWorldId): Promise<SharedPreModelWorldStateResolution> {
    if (!isCanonicalUuid(worldId)) return unresolved('CONTRADICTORY_CANONICAL_STATE');
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceRoleKey) return unresolved('WORLD_STATE_SNAPSHOT_UNAVAILABLE');

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/rest/v1/rpc/${SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC}`, {
        method: 'POST',
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_world_id: worldId }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      return unresolved(isTimeout(error) ? 'LOOKUP_TIMED_OUT' : 'LOOKUP_FAILED');
    }
    // A rejection is never a World state. A noncanonical World is the bounded
    // P0002 (canonical contradiction); any other rejection is infrastructure
    // failure.
    if (!response.ok) return unresolved(await classifyRejection(response));
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return unresolved('LOOKUP_FAILED');
    }

    const interpreted = interpretRows(payload, worldId);
    if (interpreted === 'CONTRADICTORY') return unresolved('CONTRADICTORY_CANONICAL_STATE');
    // The requested (already-branded) identity passes through unchanged after
    // the equality check above; no new SharedWorldId is minted here.
    const snapshot: SharedPreModelWorldStateSnapshot = Object.freeze({
      worldId,
      lifecycle: interpreted.lifecycle,
      phase: interpreted.phase,
      snapshotRef: fingerprintSharedPreModelWorldState({ worldId, lifecycle: interpreted.lifecycle, phase: interpreted.phase }),
    });
    return Object.freeze({ state: 'RESOLVED', snapshot } as const);
  }
}

// AbortSignal.timeout rejects fetch with a DOMException named TimeoutError.
function isTimeout(error: unknown): boolean {
  return isRecord(error) && error.name === 'TimeoutError';
}
