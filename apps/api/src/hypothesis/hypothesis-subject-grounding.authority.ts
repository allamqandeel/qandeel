// T-03C R2 - the deterministic server authority over subject-grounding
// proposals. Pure: no provider, no database, no clock, no randomness. The
// provider PROPOSES opaque handles; this authority admits only handles the
// server issued for the exact universe of this generation, refuses
// duplicates, malformed lists and over-long lists, and the database judges
// the durable proposal again against the stored universe before anything
// becomes canonical. Nothing here parses statement text, compares wording,
// consults Evidence, the Live Focus or geometry.
import {
  MAX_SUBJECT_GROUNDING_CANDIDATES,
  MAX_SUBJECT_GROUNDINGS_PER_CANDIDATE,
  MAX_SUBJECT_TEXT_LENGTH,
  SOURCE_SEMANTIC_FRONTIER_NOT_ESTABLISHED,
  SUBJECT_GROUNDING_HANDLE,
  type AuthorizedSubjectGroundingCandidate,
  type AuthorizedSubjectGroundingUniverse,
  type SubjectGroundingRejectionReason,
  type SubjectGroundingUniverseResolution,
} from './hypothesis-subject-grounding.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UNIVERSE_KEYS = ['executionId', 'frontierSp', 'entries'] as const;
const ENTRY_KEYS = ['handle', 'subjectText', 'startedSp', 'lastAttentionSp'] as const;

export type SubjectGroundingAuthorization =
  | { readonly status: 'AUTHORIZED'; readonly handles: readonly string[] }
  | { readonly status: 'REJECTED'; readonly reason: SubjectGroundingRejectionReason };

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === expected.length && expected.every((key) => key in value);
}

function sessionPosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

/**
 * Parses the database's universe presentation exactly. Anything that is not
 * the bounded, unique-handle, SP-coherent shape the server emits is rejected
 * as transport corruption (undefined), never repaired and never treated as an
 * empty universe.
 */
export function parseSubjectGroundingUniverse(value: unknown): AuthorizedSubjectGroundingUniverse | undefined {
  if (!exactKeys(value, UNIVERSE_KEYS)) return undefined;
  if (typeof value.executionId !== 'string' || !UUID.test(value.executionId)) return undefined;
  const frontierSp = value.frontierSp;
  if (frontierSp !== null && !sessionPosition(frontierSp)) return undefined;
  if (!Array.isArray(value.entries) || value.entries.length > MAX_SUBJECT_GROUNDING_CANDIDATES) return undefined;
  if (frontierSp === null && value.entries.length !== 0) return undefined;
  const handles = new Set<string>();
  const entries: AuthorizedSubjectGroundingCandidate[] = [];
  for (const raw of value.entries) {
    if (!exactKeys(raw, ENTRY_KEYS)) return undefined;
    if (typeof raw.handle !== 'string' || !SUBJECT_GROUNDING_HANDLE.test(raw.handle) || handles.has(raw.handle)) return undefined;
    if (typeof raw.subjectText !== 'string' || raw.subjectText.trim().length === 0 || raw.subjectText.length > MAX_SUBJECT_TEXT_LENGTH) return undefined;
    if (!sessionPosition(raw.startedSp) || (frontierSp !== null && raw.startedSp > frontierSp)) return undefined;
    if (raw.lastAttentionSp !== null && (!sessionPosition(raw.lastAttentionSp) || raw.lastAttentionSp < raw.startedSp || (frontierSp !== null && raw.lastAttentionSp > frontierSp))) return undefined;
    handles.add(raw.handle);
    entries.push({ handle: raw.handle, subjectText: raw.subjectText, startedSp: raw.startedSp, lastAttentionSp: raw.lastAttentionSp });
  }
  return { executionId: value.executionId, frontierSp, entries };
}

/**
 * T-03C R3 - parses the server's answer to a universe request. The database
 * either returns the durable universe presentation or the single stable
 * technical condition SOURCE_SEMANTIC_FRONTIER_NOT_ESTABLISHED, which says
 * the execution's source finalized exchange has not finished FINAL semantic
 * establishment. The two are never collapsed: a not-yet-established causal
 * frontier is retryable and grounds nothing, an established one may still be
 * legitimately empty. Anything else is transport corruption (undefined).
 */
export function parseSubjectGroundingUniverseResolution(value: unknown): SubjectGroundingUniverseResolution | undefined {
  if (exactKeys(value, ['status']) && value.status === SOURCE_SEMANTIC_FRONTIER_NOT_ESTABLISHED) {
    return { status: SOURCE_SEMANTIC_FRONTIER_NOT_ESTABLISHED };
  }
  const universe = parseSubjectGroundingUniverse(value);
  return universe ? { status: 'ESTABLISHED', universe } : undefined;
}

/**
 * Authorizes one candidate's proposed handles against the universe the
 * server supplied for this generation. An absent proposal is the explicit
 * "grounds nothing"; anything that is not a bounded, duplicate-free list of
 * handles drawn from the universe is REJECTED with a typed reason - the
 * candidate fails, it is never silently un-grounded.
 */
export function authorizeSubjectGroundingHandles(
  proposed: unknown,
  universe: ReadonlyArray<AuthorizedSubjectGroundingCandidate> | undefined,
): SubjectGroundingAuthorization {
  if (proposed === undefined) return { status: 'AUTHORIZED', handles: [] };
  if (!Array.isArray(proposed) || proposed.some((handle) => typeof handle !== 'string' || handle.length === 0)) {
    return { status: 'REJECTED', reason: 'SUBJECT_GROUNDING_MALFORMED' };
  }
  if (proposed.length > MAX_SUBJECT_GROUNDINGS_PER_CANDIDATE) return { status: 'REJECTED', reason: 'SUBJECT_GROUNDING_LIMIT_EXCEEDED' };
  if (new Set(proposed).size !== proposed.length) return { status: 'REJECTED', reason: 'SUBJECT_GROUNDING_DUPLICATE' };
  const allowed = new Set((universe ?? []).map((entry) => entry.handle));
  if (proposed.some((handle) => !allowed.has(handle))) return { status: 'REJECTED', reason: 'SUBJECT_GROUNDING_OUTSIDE_UNIVERSE' };
  return { status: 'AUTHORIZED', handles: [...(proposed as string[])] };
}
